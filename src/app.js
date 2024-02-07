const express = require("express");
require("../src/db/conn");
const Post = require("../src/models/posts");
const Profile = require("../src/models/profile");
const bodyParser = require('body-parser');
const router = express.Router();
const twilio = require('twilio');
const app = express();
const port = process.env.port || 3000; 

//SDFYRNCYCTJX8YE1G7HDUSZM  This is the recovery
// Twilio credentials
const accountSid = 'ACe21dc0ed41d7f59f855f1d6e6b227904';
const authToken = '5b9ac5802fbd9cbab0e25bfb06ef38c8';
const twilioPhoneNumber = '+18644775435';

const client = twilio(accountSid, authToken);

app.use(express.json());

app.get("/getposts/pagenumeber=:pagenumeber/pagesize=:pagesize",async(req,res)=>{
    try{
        // Pagination parameters
        const page = req.params.pagenumeber; // Current page number
        const pageSize = req.params.pagesize; // Number of posts per page

        // Calculate the number of documents to skip
        const skip = (page - 1) * pageSize;
        Post.find({}).skip(skip).limit(pageSize).then((post)=>{
            Post.countDocuments({})
            .then(count => {
                // Attach the count to the response
                res.status(200).json({totalcount:count,data:post})
            });
        }).catch((e)=>{
            console.error("Error saving post:", error);
            res.status(500).json({ error: "Internal Server Error", error });
        })
    }catch(error){
        res.status(400).json({"message":"Can not fetch data."})
    }
})

app.get("/getuserposts/userid=:userid",async(req, res)=>{
    try{
        const userid = req.params.userid
        Post.find({"author":userid}).then((post)=>{
            Post.countDocuments({author:userid})
            .then(count => {
                res.status(200).json({count:count,data:post})
            });
        }).catch((e)=>{
            console.error("Error saving post:", error);
            res.status(500).json({ error: "Internal Server Error", error });
        })
    }catch(e){
        res.status(400).json({"message":"Can not fetch data."})
    }
})

app.get("/get-profile/userid=:userid",async(req, res)=>{
    try{
        const userid = req.params.userid
        console.log(userid)
        if (userid.match(/^[0-9a-fA-F]{24}$/)) {
            // Yes, it's a valid ObjectId, proceed with `findById` call.
            Profile.findById(userid).then((profile)=>{
                res.status(200).json({data:profile})
            }).catch((error) => {
                console.error("Error saving post:", error);
                res.status(500).json({ error: "Internal Server Error", error });
              });
        }
        else{
            res.status(400).json({"message":"id is not valid."})
        }
    }catch(e){
        res.status(400).json({"message":"Can not fetch data."})
    }
})

app.patch("/editpost/postid=:postid",async(req,res)=>{
  try{
    const postid = req.params.postid;  
    console.log(req.body);
    Post
      .findByIdAndUpdate(postid,req.body,{
        new:true
      })
      .then((post) => {
        // Construct the response object
        const response = {
          message: "Post update successfully",
        };
        // Send the response back to the client
        res.status(200).json(response);
      })  
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
    }catch(error){
        res.send(e);
    }  
})

app.delete("/deletepost/postid=:postid",async(req,res)=>{
    try{
    const postid = req.params.postid;  
    console.log(req.body);
    Post
      .findByIdAndDelete(postid)
      .then((post) => {
        // Construct the response object
        Profile.updateMany(
          { posts: postid },
          { $pull: { posts: postid } }
      ).then(()=>{
        const response = {
          message: "Data delete successfully",
        };
        // Send the response back to the client
        res.status(200).json(response);
      })
    
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
    }catch(error){
        res.send(e);
    }
})

app.patch("/updateprofile/userid=:userid", async(req,res)=>{
    try{
    const userid = req.params.userid;
    // const profileRecord = new Profile(req.body);
    console.log(req.body);
    Profile
      .findByIdAndUpdate(userid,req.body,{
        new:true
      })
      .then((profile) => {
        // Construct the response object
        const response = {
          message: "Data updated successfully",
          data: profile,
        };
        // Send the response back to the client
        res.status(200).json(response);
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
    }catch(e){
        res.send(e);
    }
})

//Post api for store phone number on profile collections
app.post("/profile", async(req,res)=>{
    try{
    const profileRecord = new Profile(req.body);
    console.log(req.body);
    profileRecord
      .save()
      .then((profile) => {
        // Construct the response object
        const response = {
          message: "Data inserted successfully",
          data: profile,
        };
        // Send the response back to the client
        res.status(200).json(response);
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
    }catch(e){
        res.send(e);
    }
})
//Post api for store post details
app.post("/post", async (req, res) => {
  try {
    // const { content,author } = req.body;
    const postRecords = new Post(req.body);
    console.log(req.body)
    postRecords.save()
      .then((newpost) => {
        console.log(newpost.content)
        // Update the user's posts array with the newly created post
        Profile.findByIdAndUpdate(newpost.author, { $push: { posts: newpost._id } })
        .then((profile)=>{
            console.log(profile.posts)
        })
        // Construct the response object
        const response = {
          message: "Data inserted successfully",
          data: newpost,
        };
        // Send the response back to the client
        res.status(200).json(response);
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
  } catch (e) {
    res.send(e);
  }
});

app.get("/", async (req, res) => {
  res.send("hello this is my first application");
});

app.listen(port, () => {
  console.log("connecting is successfully", { port });
});

// Route handler to send OTP
app.post('/send-otp', (req, res) => {
    const { phoneNumber } = req.body;

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Send OTP via SMS using Twilio
    client.messages
        .create({
            body: `Your OTP is: ${otp}`,
            from: twilioPhoneNumber,
            to: phoneNumber
        })
        .then(message => {
            console.log(`OTP sent: ${message.sid}`);
            res.json({ success: true, message: 'OTP sent successfully' });
        })
        .catch(error => {
            console.error('Error sending OTP:', error);
            res.status(500).json({ success: false, message: 'Failed to send OTP' });
        });
});

// Route handler to validate OTP
app.post('/validate-otp', (req, res) => {
    const { otp, userEnteredOTP } = req.body;

    // Validate OTP
    if (otp === userEnteredOTP) {
        res.status(200).json({ success: true, message: 'OTP validated successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});


