require('dotenv').config()
const express = require("express");
const AWS = require("aws-sdk");
require("./conn");
const Post = require("./src/models/posts");
const Profile = require("./src/models/profile");
const Message = require("./src/models/message");
const Chatroom = require("./src/models/chatroom");
const Photo = require("./src/models/profilephoto");
const path = require('path');
const multer = require("multer");
const bodyParser = require("body-parser");
const router = express.Router();
const twilio = require("twilio");
const app = express();
const port = process.env.PORT || 3000;
const server = require("http").createServer(app);
const io = require("socket.io")(server);
let newotp = "";
let baseURL = ""
const cors = require("cors");


// app.use((req, res, next) => {
//   // Construct the base URL
//   req.baseURL = `${req.protocol}://${req.get('host')}`;
//   next();
// });

// // Now you can access the base URL using req.baseURL in your routes

// // Example route
// app.get('/test', (req, res) => {
//   // Use req.baseURL to get the base URL
//   baseURL = req.baseURL;
//   console.log("base url is",baseURL)
//   res.send(`Base URL: ${baseURL}`);
// });

// Initialize AWS SDK
AWS.config.update({
  accessKeyId: "AKIAU6GD2MAPUGPGD4OI",
  secretAccessKey: "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",
  region: "ap-south-1",
});

// const sns = new AWS.SNS();

// Enable CORS for all routes

// Set the AWS region
// AWS.config.update({ region: 'ap-south-1' });

// Create a new instance of the Amazon SNS service object
const sns = new AWS.SNS();

// Enable CORS with specific options
app.use(
  cors({
    origin: "*", // Allow requests from this origin
    methods: ["GET", "POST"], // Allow only specified HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow only specified headers
    credentials: true, // Allow credentials (e.g., cookies, authorization headers)
  })
);
app.use(cors());

//SDFYRNCYCTJX8YE1G7HDUSZM  This is the recovery
// Twilio credentials
const accountSid = "ACe21dc0ed41d7f59f855f1d6e6b227904";
const authToken = "3e3c27864cd6f219444a47448a16df07";
const twilioPhoneNumber = "+18644775435";

const client = twilio(accountSid, authToken);

app.use(express.json());

// Web Socket integration connection
io.on("connection", (socket) => {
  console.log("New user connected:", socket.handshake.auth.token);

  let userId = socket.handshake.auth.token;

  Profile.findByIdAndUpdate({ _id: userId }, { $set: { is_online: "1" } }).then(
    () => {
      console.log("profile data update complete", socket.handshake.auth.token);
      socket.broadcast.emit("setUserOnline", { user_id: userId });
    }
  );

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId); // Join specific chat room
  });

  socket.on("sendMessage", (data) => {
    // Broadcast message to connected users in the room
    // io.to(message.chatRoom).emit("messageReceived", message);
    const { senderId, recipientId, content } = data;
    // console.log("dsafdsaf"+data)
    // console.log(data.content)
    // Create a new message instance
    const newMessage = new Message({
      senderId,
      recipientId,
      content,
    });

    newMessage
      .save()
      .then((message) => {
        console.log(message);
      })
      .catch((error) => {
        console.error("Error saving post:", error);
      });

    console.log("=====>>>>>", data);
    io.emit("sendMessage", data);
  });

  // ... (other events)

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    Profile.findByIdAndUpdate(
      { _id: userId },
      { $set: { is_online: "0" } }
    ).then(() => {
      console.log("profile data update complete", socket.handshake.auth.token);
      socket.broadcast.emit("setUserOffline", { user_id: userId });
    });
  });

  // Handle fetching messages for a user
  socket.on("fetchMessages", async (data) => {
    try {
      const messages = await Message.find({
        $or: [
          { sender: data.user_id, recipientId: data.recipient_id },
          { sender: data.recipient_id, recipientId: data.user_id },
        ],
      });
      socket.emit("messages", { oldchat: messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      // You can emit an error event or handle the error in another way
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
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
        .sort({ createdAt: -1 })
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

// Your API route handler
app.get("/getMessagesWithRecipientProfiles", async (req, res) => {
  try {
    // Aggregate pipeline to get distinct recipientIds and populate recipient details
    // Step 1: Fetch distinct recipientIds
    const recipientIds = await Message.distinct("recipientId", {
      sender: req.userId,
    });

    // Step 2: Populate profile details for each recipientId
    const recipientDetails = await Profile.find({ _id: { $in: recipientIds } });

    res.json(recipientDetails);
  } catch (error) {
    console.error("Error fetching messages with recipient profiles:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
//This api is used for upload image of the profile.
app.post("/upload/userid=:userid", upload.single("photo"), async (req, res) => {
  try {
    const file = req.file;
    const profileId = req.params.userid;
    const photo = new Photo({
      title: file.filename,
      imageUrl: file.path,
      profile: profileId,
    });
    photo
      .save()
      .then((photo) => {
        console.log(photo.content);
        // Update the user's posts array with the newly created post
        Profile.findByIdAndUpdate(photo.profile, {
          // $set: { profilephoto: [] }, // Clear the profilephoto array
          $push: { profilephoto: photo._id }, // Push the new photo._id
        }).then((profile) => {
          const response = {
            message: "Photo inserted inserted successfully",
            data: photo,
          };
          // Send the response back to the client
          res.status(200).json(response);
        });
        // Construct the response object
        
        // Profile.findById(photo.profile)
        //   .then((profile) => {
        //     // Clear the profilephoto array
        //     profile.profilephoto = [];

        //     // Push the new photo._id
        //     profile.profilephoto.push(photo._id);

        //     // Save the updated profile document
        //     return profile.save();
        //   })
          // .then((updatedProfile) => {
          //   // Log the updated profile's posts
          //   console.log(updatedProfile.posts);
          // })
          // .catch((error) => {
          //   // Handle errors
          //   console.error(error);
          // });
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

//This api is used for get connection of profile.
app.get(
  "/getuser_acceptconnects/userid=:userid&pagenumber=:pagenumeber&count=:pagesize",
  async (req, res) => {
    try {
      const userid = req.params.userid;
      // Pagination parameters
      const page = req.params.pagenumeber; // Current page number
      const pageSize = req.params.pagesize; // Number of posts per page

      // Calculate the number of documents to skip
      const skip = (page - 1) * pageSize;
      Profile.findById(userid)
        .populate("connections")
        .skip(skip)
        .limit(pageSize)
        .then((profile) => {
          const count = profile.connections.length;
          const pagesize = count > 10 ? parseInt(count / 10) : 1;
          res.status(200).json({ pagenumber: pagesize, data: profile });
        })
        .catch((e) => {
          console.error("Error saving post:", e);
          res.status(500).json({ error: "Internal Server Error", e });
        });
    } catch (e) {
      res.status(400).json({ message: "Can not fetch data." });
    }
  }
);

// Route to handle removing a requested connection from a profile
app.post(
  "/remove-requested-connection/userid=:profileId/request-connectionid=:requestedConnectionId",
  async (req, res) => {
    try {
      const profileId = req.params.profileId;
      const requestedConnectionId = req.params.requestedConnectionId;

      // Find the profile by ID
      const profile = await Profile.findById(profileId);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Check if the requested connection ID exists in the requestedConnections array
      const index = profile.requestedConnections.indexOf(requestedConnectionId);

      if (index === -1) {
        return res.status(404).json({
          data: false,
          message: "Requested connection not found in the profile",
        });
      }

      // Remove the requested connection ID from the requestedConnections array
      profile.requestedConnections.splice(index, 1);

      // Save the profile with the updated requestedConnections array
      await profile.save();

      res.status(200).json({
        data: true,
        message: "Requested connection removed successfully",
      });
    } catch (error) {
      console.error("Error removing requested connection:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

//This api is used for getting resquest connections of the profile.
app.get(
  "/getuser_resquestconnects/userid=:userid&pagenumber=:pagenumeber&count=:pagesize",
  async (req, res) => {
    try {
      const userid = req.params.userid;
      // Pagination parameters
      const page = req.params.pagenumeber; // Current page number
      const pageSize = req.params.pagesize; // Number of posts per page

      // Calculate the number of documents to skip
      const skip = (page - 1) * pageSize;
      Profile.findById(userid)
        .populate("requestedConnections")
        .skip(skip)
        .limit(pageSize)
        .then((profile) => {
          const count = profile.requestedConnections.length;
          const pagesize = count > 10 ? parseInt(count / 10) : 1;
          res.status(200).json({ pagenumber: pagesize, data: profile });
        })
        .catch((e) => {
          console.error("Error saving post:", e);
          res.status(500).json({ error: "Internal Server Error", e });
        });
    } catch (e) {
      res.status(400).json({ message: "Can not fetch data." });
    }
  }
);

//This api is user for get all post of the profile.
app.get(
  "/getuserposts/userid=:userid&pagenumber=:pagenumeber&count=:pagesize",
  async (req, res) => {
    try {
      const userid = req.params.userid;
      // Pagination parameters
      const page = req.params.pagenumeber; // Current page number
      const pageSize = req.params.pagesize; // Number of posts per page

      // Calculate the number of documents to skip
      const skip = (page - 1) * pageSize;
      Post.find({ author: userid })
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .then((post) => {
          Post.countDocuments({ author: userid }).then((count) => {
            const pagesize = count > 10 ? parseInt(count / 10) : 1;
            res.status(200).json({ pagenumber: pagesize, data: post });
          });
        })
        .catch((e) => {
          console.error("Error saving post:", e);
          res.status(500).json({ error: "Internal Server Error", e });
        });
    } catch (e) {
      res.status(400).json({ message: "Can not fetch data." });
    }
  }
);

//This api is user for send request connections.
app.post("/requestconnections/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    const connectionid = req.body.connectionid;
    //before add connections id check connections is already exist or not
    console.log("user id is ", userid);
    console.log("connection id is", connectionid);
    Profile.findOneAndUpdate(
      { _id: connectionid, requestedConnections: { $ne: userid } }, // Check if connectionid doesn't exist
      { $addToSet: { requestedConnections: userid } }, // Add connectionid if it doesn't exist
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
    res.status(400).json({ message: "Can not fetch data.", e });
  }
});

//This api is user for accept request connection on this profile.
app.post("/acceptconnections/userid=:userid", async (req, res) => {
  try {
    const userid = req.params.userid;
    const connectionid = req.body.connectionid;
    console.log("user id is ", userid);
    console.log("connection id is", connectionid);
    Profile.findOneAndUpdate(
      { _id: userid },
      {
        $addToSet: { connections: connectionid }, // Add the connectionid to the connections array
        $pull: { requestedConnections: connectionid }, // Remove the connectionid from the requestedConnections array
      },
      { new: true }
    )
      .then((profile) => {
        return Profile.findOneAndUpdate(
          { _id: connectionid },
          {
            $addToSet: { connections: userid }, // Add the userid to the connections array of the connectionid user
          },
          { new: true }
        );
      })
      .then((connectionUser) => {
        res.status(200).json({ message: "request accept successfuly" });
        console.log("User profile updated:", user);
        console.log("Connection user profile updated:", connectionUser);
        // Send response or do other actions
      })
      .catch((err) => {
        // Handle error
      });
  } catch (e) {
    res.status(400).json({ message: "Can not fetch data." });
  }
});

app.get(
  "/get-profile/userid=:userid/checkconnection=:checkconnection",
  async (req, res) => {
    try {
      const userid = req.params.userid;
      const check_connection = req.params.checkconnection;
      console.log("checkconnection", check_connection);
      console.log("userid", userid);
      if (userid.match(/^[0-9a-fA-F]{24}$/)) {
        // Yes, it's a valid ObjectId, proceed with `findById` call.
        Profile.findById(userid)
          .populate("profilephoto")
          .populate("connections")
          .populate("posts")
          .populate("requestedConnections")
          .then((profile) => {
            if (userid == check_connection) {
              res.status(200).json({ message: "please verify data..." });
              return;
            }
            const isConnectionExists = profile.connections.some((connection) =>
              connection.equals(check_connection)
            );
            const isInRequestConnectionExists =
              profile.requestedConnections.some((connection) =>
                connection.equals(check_connection)
              );
            console.log(isConnectionExists);
            res.status(200).json({
              connection_exist: isConnectionExists,
              request_connection_exist: isInRequestConnectionExists,
              data: profile,
            });
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
  }
);

//This api is used for edit particular post.
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

//This api is used for delete particular post on user.
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

//This api is user for update profile.
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

// app.listen(port, () => {
//   console.log("connecting is successfully", { port });
// });

//This api is user for send otp to random user.
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

// This api is user for validation and creation of profile
app.post("/validate-otp", (req, res) => {
  const { phoneNumber, userEnteredOTP } = req.body;
  console.log(newotp);
  // Validate OTP
  if (newotp == userEnteredOTP) {
    Profile.findOne({ phonenumber: phoneNumber })
      .then((existingUser) => {
        if (existingUser) {
          console.log("hello api call is happening", phoneNumber);
          // If a user with the phone number already exists, send back the user's ID
          const response = {
            success: false,
            message: "User with the provided phone number already exists",
            data: { _id: existingUser._id },
          };
          res.status(200).json(response);
        } else {
          const profileRecord = new Profile({ phonenumber: phoneNumber });
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

//This api is user for serach
app.get("/serachposts", async (req, res) => {
  const { searchText } = req.query;

  try {
    // Split the search text into individual words
    const searchWords = searchText.split(" ");

    // Construct an array of regular expressions to match any of the search words
    const regexArray = searchWords.map((word) => new RegExp(word, "i"));

    // Query the database for posts containing any of the search words in their content
    const posts = await Post.find({ content: { $in: regexArray } }).populate(
      "author"
    );

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
