require("dotenv").config();

const express = require("express");
const bodyparser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const app=express();
const session=require('express-session');
const passport =require('passport');
const passportLocalMongoose=require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate=require('mongoose-findorcreate');


// Middlewares
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyparser.urlencoded({ extended: true}));

app.use(session({
    secret:"Our Little secret.",
    resave:false,
    saveUninitialized:false
}));
app.use(passport.initialize());     // it tells our app to Initialize the passport
app.use(passport.session());        // use passport to manage our sessions

// Connect MONGO DB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    secret: String,
    googleId:String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema)

passport.use(User.createStrategy());        // use passport to set up our local authentication setup
// passport.serializeUser(User.serializeUser()); // creates a cokkie
// passport.deserializeUser(User.deserializeUser()); // destroys that cookie
passport.serializeUser(function(user,done){
    done(null,user.id);
});
passport.deserializeUser(function(id,done){
    User.findById(id,function(err,user){
        done(err,user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


// Routes

// Home
app.get("/", function(req, res) {

    res.render("home");
});

// Google Auth
app.get('/auth/google',
    passport.authenticate('google',{scope:["profile"]})
);

app.get('/auth/google/secrets',
    passport.authenticate('google',{failureRedirect:'/login'}),
    (req,res)=>{
        // Succesfully authenticated, redirect secrets
        res.redirect('/secrets');
    }
)

// Login
app.get("/login", function(req, res) {

    res.render("login");
});
app.post('/login',(req,res)=>{
    const user=new User({
        username:req.body.username,
        password:req.body.password
    });

    req.login(user,function(err){
        if(err){
            // console.log(err);
            // console.log('Redirect to Login');
             res.redirect('/login');
            return next(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect('/secrets');
            })
        }
    })
})



// Register
app.get("/register", function(req, res) {

    res.render("register");
});
app.post("/register", function(req, res){
    User.register({username:req.body.username},req.body.password,(err,user)=>{
        if(err){
            // console.log(err);
            console.log("Redirect to Register");
            res.redirect('/register');
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect('/secrets');
            });
        }
    });
});

// Secret
app.get('/secrets',(req,res)=>{
    // if(req.isAuthenticated()){
    //     res.render('secrets');
    // }else{
    //     res.redirect('/login')
    // }
// console.log(req.user.id);
    User.find({"secret":{$ne:null}}, function(err,foundUser){
        if(err)
        return console.log(err);
        else{
            if(foundUser){
                res.render('secrets',{usersWithSecrets:foundUser});
            }
        }
    });
});

app.get('/submit',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('submit');
    }else{
        res.redirect('/login')
    }
})

app.post('/submit',(req,res)=>{
    const submittedSecret=req.body.secret;
    User.findById(req.user.id,function(err,FoundUser){
        if(err){
            console.log(err);
        }else{
            if(FoundUser){
                FoundUser.secret=submittedSecret;
                FoundUser.save(function(){
                    res.redirect('/secrets');
                });
            }
        }
    });
});

// Logout
app.get('/logout',(req,res,next)=>{
   console.log("I am in Logout...");
//    res.cookie('connect.sid', '', {expires: new Date(1), path: '/' });
//    req.logOut();

    // res.clearCookie('connect.sid', { path: '/' });
    // res.redirect('/');

    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    
});


app.listen("3000", function(){
    console.log("server running at port 3000");
})