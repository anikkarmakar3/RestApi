const express = require("express");
require("../src/db/conn");
const Post = require("../src/models/posts");
const Profile = require("../src/models/profile");
const Message = require("../src/models/message");
const Chatroom = require("../src/models/chatroom");
const Photo = require("../src/models/profilephoto");
const multer = require("multer");
const bodyParser = require("body-parser");
const router = express.Router();
const twilio = require("twilio");
const app = express();
const port = process.env.port || 3000;
const server = require("http").createServer(app);
const io = require("socket.io")(server);
let newotp = "";

//SDFYRNCYCTJX8YE1G7HDUSZM  This is the recovery
// Twilio credentials
const accountSid = "ACe21dc0ed41d7f59f855f1d6e6b227904";
const authToken = "5b9ac5802fbd9cbab0e25bfb06ef38c8";
const twilioPhoneNumber = "+18644775435";

const client = twilio(accountSid, authToken);

app.use(express.json());

//Web Socket integration connection

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId); // Join specific chat room
  });

  socket.on("sendMessage", (message) => {
    // Broadcast message to connected users in the room
    io.to(message.chatRoom).emit("messageReceived", message);
  });

  // ... (other events)

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.post("/chat-rooms", async (req, res) => {
  // Create a new chat room based on req.body data
  try {
    const newRoom = await Chatroom.create(req.body);
    io.emit("joinRoom", newRoom); // Notify connected users
    res.status(200).json(newRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Message sending and retrieval
app.post("/messages", async (req, res) => {
  // Create a new message based on req.body data
  try {
    const newMessage = await Message.create(req.body);
    await Chatroom.findByIdAndUpdate(newMessage.chatRoom, {
      $push: { messages: newMessage._id },
    });
    io.to(newMessage.Chatroom).emit("messageReceived", newMessage); // Send to specific room
    res.status(200).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get(
  "/getposts/pagenumber=:pagenumeber&count=:pagesize",
  async (req, res) => {
    try {
      // Pagination parameters
      const page = req.params.pagenumeber; // Current page number
      const pageSize = req.params.pagesize; // Number of posts per page

      // Calculate the number of documents to skip
      const skip = (page - 1) * pageSize;
      Post.find({})
        .skip(skip)
        .limit(pageSize)
        .populate("author")
        .then((post) => {
          Post.countDocuments({}).then((count) => {
            const pagesize = count > 10 ? parseInt(count / 10) : 1;
            // Attach the count to the response
            res.status(200).json({ pagenumber: pagesize, data: post });
          });
        })
        .catch((e) => {
          console.error("Error saving post:", error);
          res.status(500).json({ error: "Internal Server Error", error });
        });
    } catch (error) {
      res.status(400).json({ message: "Can not fetch data." });
    }
  }
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Create an instance of Multer for handling file uploads
const upload = multer({ storage: storage });

app.post("/upload/userid=:userid", upload.single("photo"), async (req, res) => {
  try {
    const file = req.file;
    const profileId = req.params.userid;
    const photo = new Photo({
      title: file.filename,
      imageUrl: file.path,
      profile: profileId,
    });
    console.log(photo);
    photo
      .save()
      .then((photo) => {
        console.log(photo.content);
        // Update the user's posts array with the newly created post
        Profile.findByIdAndUpdate(photo.profile, {
          $push: { profilephoto: photo._id },
        }).then((profile) => {
          console.log(profile.posts);
        });
        // Construct the response object
        const response = {
          message: "Photo inserted inserted successfully",
          data: photo,
        };
        // Send the response back to the client
        res.status(200).json(response);
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/getuserposts/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    Post.find({ author: userid })
      .then((post) => {
        Post.countDocuments({ author: userid }).then((count) => {
          res.status(200).json({ count: count, data: post });
        });
      })
      .catch((e) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
  } catch (e) {
    res.status(400).json({ message: "Can not fetch data." });
  }
});

app.post("/requestconnections/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    const connectionid = req.body.connectionid;
    //before add connections id check connections is already exist or not
    console.log("user id is ", userid);
    console.log("connection id is", connectionid);
    Profile.findOneAndUpdate(
      { _id: userid, requestedConnections: { $ne: connectionid } }, // Check if connectionid doesn't exist
      { $addToSet: { requestedConnections: connectionid } }, // Add connectionid if it doesn't exist
      { new: true }
    )
      .then((profile) => {
        if (profile) {
          res
            .status(200)
            .json({ message: "request succesfully", data: profile });
        } else {
          res.status(400).json({
            message:
              "Connection ID already exists in the requested connections array.",
          });
        }
      })
      .catch((e) => {
        console.error("Error saving post:", e);
        res.status(500).json({ error: "Internal Server Error", e });
      });
  } catch (e) {
    res.status(400).json({ message: "Can not fetch data." });
  }
});

app.post("/acceptconnections/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    const connectionid = req.body.connectionid;
    console.log("user id is ", userid);
    console.log("connection id is", connectionid);
    Profile.findOneAndUpdate(
      { _id: userid },
      { $push: { connections: connectionid } },
      { $pull: { requestedConnections: connectionid } },
      { new: true }
    )
      .then((profile) => {
        res
          .status(200)
          .json({ message: "request accept successfuly", data: profile });
      })
      .catch((e) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
  } catch (e) {
    res.status(400).json({ message: "Can not fetch data." });
  }
});

app.get("/get-profile/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    console.log(userid);
    if (userid.match(/^[0-9a-fA-F]{24}$/)) {
      // Yes, it's a valid ObjectId, proceed with `findById` call.
      Profile.findById(userid)
        .then((profile) => {
          res.status(200).json({ data: profile });
        })
        .catch((error) => {
          console.error("Error saving post:", error);
          res.status(500).json({ error: "Internal Server Error", error });
        });
    } else {
      res.status(400).json({ message: "id is not valid." });
    }
  } catch (e) {
    res.status(400).json({ message: "Can not fetch data." });
  }
});

app.patch("/editpost/postid=:postid", async (req, res) => {
  try {
    const postid = req.params.postid;
    console.log(req.body);
    Post.findByIdAndUpdate(postid, req.body, {
      new: true,
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
  } catch (error) {
    res.send(e);
  }
});

app.delete("/deletepost/postid=:postid", async (req, res) => {
  try {
    const postid = req.params.postid;
    console.log(req.body);
    Post.findByIdAndDelete(postid)
      .then((post) => {
        // Construct the response object
        Profile.updateMany(
          { posts: postid },
          { $pull: { posts: postid } }
        ).then(() => {
          const response = {
            message: "Data delete successfully",
          };
          // Send the response back to the client
          res.status(200).json(response);
        });
      })
      .catch((error) => {
        console.error("Error saving post:", error);
        res.status(500).json({ error: "Internal Server Error", error });
      });
  } catch (error) {
    res.send(e);
  }
});

app.patch("/updateprofile/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    // const profileRecord = new Profile(req.body);
    console.log(req.body);
    Profile.findByIdAndUpdate(userid, req.body, {
      new: true,
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
  } catch (e) {
    res.send(e);
  }
});

//Post api for store phone number on profile collections
app.post("/profile", async (req, res) => {
  try {
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
  } catch (e) {
    res.send(e);
  }
});
//Post api for store post details
app.post("/post", async (req, res) => {
  try {
    // const { content,author } = req.body;
    const postRecords = new Post(req.body);
    console.log(req.body);
    postRecords
      .save()
      .then((newpost) => {
        console.log(newpost.content);
        // Update the user's posts array with the newly created post
        Profile.findByIdAndUpdate(newpost.author, {
          $push: { posts: newpost._id },
        }).then((profile) => {
          console.log(profile.posts);
        });
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
app.post("/send-otp", (req, res) => {
  const { phoneNumber } = req.body;

  // Generate a random 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000);
  newotp = otp.toString();
  console.log(newotp);
  // Send OTP via SMS using Twilio
  client.messages
    .create({
      body: `Your OTP is: ${otp}`,
      from: twilioPhoneNumber,
      to: phoneNumber,
    })
    .then((message) => {
      console.log(`OTP sent: ${message.sid}`);
      res.json({ success: true, message: "OTP sent successfully" });
    })
    .catch((error) => {
      console.error("Error sending OTP:", error);
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    });
});

// Route handler to validate OTP
app.post("/validate-otp", (req, res) => {
  const { phoneNumber,userEnteredOTP } = req.body;
  console.log(newotp);
  // Validate OTP
  if (newotp == userEnteredOTP) {
    Profile.findOne({ phonenumber:phoneNumber })
      .then((existingUser) => {
        if (existingUser) {
          console.log("hello api call is happening",phoneNumber);
          // If a user with the phone number already exists, send back the user's ID
          const response = {
            success: false,
            message: "User with the provided phone number already exists",
            data: { _id: existingUser._id },
          };
          res.status(200).json(response);
        } else {
          const profileRecord = new Profile({phonenumber:phoneNumber});
          console.log(req.body);
          profileRecord
            .save()
            .then((profile) => {
              // Construct the response object
              const response = {
                success: true,
                message: "OTP validated successfully",
                data: profile,
              };
              // Send the response back to the client
              res.status(200).json(response);
            })
            .catch((error) => {
              console.error("Error saving post:", error);
              res.status(500).json({ error: "Internal Server Error", error });
            });
        }
      })
      .catch((error) => {
        // Handle error while finding existing user
        const response = {
          success: false,
          message: "Error checking existing user",
          error: error.message,
        };
        res.status(500).json(response);
      });

    // res
    //   .status(200)
    //   .json({ success: true, message: "OTP validated successfully", authenticateKey: authenticatekey  });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});
