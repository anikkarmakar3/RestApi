const mongoose = require("mongoose")

mongoose.connect("mongodb+srv://anikkarmakar3:YJjhW6YQJ29u31us@cluster0.wovbies.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",{
}).then(()=>{
    console.log("db connecting successfully")
}).catch((e)=>{
    console.log("db connecting unsuccessfully",e)
})

