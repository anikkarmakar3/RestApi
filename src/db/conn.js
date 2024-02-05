const mongoose = require("mongoose")

mongoose.connect("mongodb://localhost:27017/posts",{
}).then(()=>{
    console.log("db connecting successfully")
}).catch((e)=>{
    console.log("db connecting unsuccessfully",e)
})

