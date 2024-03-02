require('dotenv').config()
const mongoose = require("mongoose")

mongoose.connect(process.env.MONGODB_URI,{
}).then(()=>{
    console.log("db connecting successfully")
}).catch((e)=>{
    console.log("db connecting unsuccessfully",e)
})

