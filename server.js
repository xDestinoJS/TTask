const express = require("express");
const cookieParser = require('cookie-parser');
const app = express();
app.use(cookieParser());
const { Webhook, MessageBuilder } = require('discord-webhook-node');

const http = require('http').Server(app);
const io = require('socket.io')(http);
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fs = require('fs');

const { promisify } = require('util');
const readFile = promisify(fs.readFile);

let defaultAccEmail = "" //any email you wanna use to login (this is the default, others can be made at /register)
let defaultRemindEmail = "" //email of your email account (duh)
let defaultRemindPass = "" //password for your email account

let users = [
  {
    email: defaultAccEmail,
    password: "$2b$10$KmLEmt181AaSdsxhhtNrsO1gF6TykMIKJL1rzgmlpLsbVd/60e3RK", //bcrypt hash of a password
    tasks: [ // don't touch!
      
    ]
  }
]

async function sendEmail(recipient, subject, path){
  console.log(recipient)
  console.log(path)
  var transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: defaultRemindEmail,
      pass: defaultRemindPass
    }
  });
  console.log("2")
  var mailOptions = {
    from: defaultRemindEmail,
    to: recipient,
    subject: subject,
    html: await readFile(path, 'utf8')
  };
  console.log("3")
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

async function sendEmailTxt(recipient, subject, txt){
  console.log(recipient)
  var transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
      user: defaultRemindEmail,
      pass: defaultRemindPass
    }
  });
  console.log("2")
  var mailOptions = {
    from: defaultRemindEmail,
    to: recipient,
    subject: subject,
    text: txt
  };
  console.log("3")
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

app.use(express.static("public"));

app.get("/", (request, response) => {
  let sid = request.cookies["session_id"]
  
  if(sid){
    let acc = users.find(obj => {
        return obj.email == sid
    })
    
    if(!acc){
      response.redirect("/register")
    } else {
      response.redirect("/app")
    }
  } else {
    response.redirect("/register")
  }
});

app.get("/login", (request, response) => {
  response.sendFile(__dirname + "/views/login.html");
});

app.get("/ac", (request, response) => {
  response.sendFile(__dirname + "/views/accountCreated.html");
});

app.get("/register", (request, response) => {
  response.sendFile(__dirname + "/views/register.html");
});

app.get("/app", (request, response) => {
  let sid = request.cookies["session_id"]
  
  if(sid){
    let acc = users.find(obj => {
        return obj.email == sid
    })
    
    if(!acc){
      response.redirect("/register")
    }
  } else {
    response.redirect("/register")
  }
  
  response.sendFile(__dirname + "/views/app.html");
});


io.on('connection', (socket) => {
  socket.on("getTasks", (msg, fn) => {
    console.log(msg.email)
      let acc = users.find(obj => {
        console.log(obj.email)
          return obj.email == msg.email
      })
      
      if(acc){
        fn(acc.tasks)
      }
  })
  
  socket.on('register', (msg, fn) => {
    bcrypt.hash(msg.password, 10, function(err, hash) {
        let result = users.find(obj => {
          return obj.email == msg.email
        })
        
        if(!result){
          msg.password = hash
          sendEmail(msg.email, "Your account was created!", './views/accountCreated.html')
          users.push({
            email: msg.email,
            password: msg.password,
            tasks: []
          })
          
          fn({
            res: true
          })
        } else {
          fn({
            res: false
          })
        }
    });
  });
  
  socket.on('login', (msg, fn) => {
    let res = users.find(obj => {
        return obj.email == msg.email
    })
    
    if(res){
      bcrypt.compare(msg.password, res.password, function(err, result){
        if(result){
           fn({
             res: true,
             sessionId: msg.sessionId
           })
        } else {
          fn({
            res: false
          })
        }
      })
    } else {
      fn({
        res: false
      })
    }
//     
  })
  
  socket.on("changeTaskStatus", (msg, fn) => {
      if(msg.id){
        let acc = users.find(obj => {
            return obj.email == msg.id
        })
        
        if(acc){
          acc.tasks[msg.index].completed = !acc.tasks[msg.index].completed
          fn({
            res: acc.tasks[msg.index]
          })
        }
      }
  })
  
  socket.on('addTask', (msg, fn) => {
    console.log(msg.id)
    console.log(users)
    if(msg.id){
      let acc = users.find(obj => {
          return obj.email == msg.id
      })
      
      console.log(acc)
      if(acc){
        console.log(acc.tasks.length)
        acc.tasks.push({
          title: msg.title,
          epoch: msg.epoch,
          time: null,
          completed: false
        })
        let length = acc.tasks.length
        
        let wait = (msg.epoch - new Date()) - 43200000
        
        if(wait<0){
          wait = (msg.epoch - new Date()) - ((msg.epoch - new Date()) / 2)
        }
        
        console.log(wait)
        
        function updt(t) {
          let diff = new Date(t) - new Date();

          let days = Math.floor(diff / (1000 * 60 * 60 * 24));
          let hours = Math.floor(diff / (1000 * 60 * 60));
          let mins = Math.floor(diff / (1000 * 60));
          let secs = Math.floor(diff / 1000);

          let d = days;
          let h = hours - days * 24;
          let m = mins - hours * 60;
          let s = secs - mins * 60;

          return `${d} days, ${h} hours, ${m} minutes and ${s} seconds`
        }
        
        setTimeout(function(){
          let racc = users.find(obj => {
              return obj.email == msg.id
          })
          
          if(racc.tasks[racc.tasks.length-1].completed == false){
            console.log("DOOOONE")
            sendEmailTxt(acc.email, "[📝] Upcoming task!", `Your task (${msg.title}) for ${new Date(msg.epoch)} should be completed before ${updt(msg.epoch)}! - (this email was sent because you didn't mark the task as complete!)`)

            if(msg.webhook){
              const hook = new Webhook(msg.webhook);

              if(hook){
                const IMAGE_URL = 'https://i.imgur.com/hypeVWp.png';
                hook.setUsername('Planner');
                hook.setAvatar(IMAGE_URL);

                const embed = new MessageBuilder()
                .setTitle('[📝] Upcoming task!')
                .setColor('#00b0f4')
                .setDescription(`Your task **(${msg.title})** for **${new Date(msg.epoch)}** should be completed before ${updt(msg.epoch)}! \n\n (this notification was sent because you didn't mark the task as complete!)`)
                .setTimestamp();

                hook.send(embed);
              }
            }
          }
        }, wait)
        
        setTimeout(function(){
          let racc = users.find(obj => {
              return obj.email == msg.id
          })
          
          console.log(racc.tasks[racc.tasks.length-1].completed)
          
          if(racc.tasks[racc.tasks.length-1].completed == false){
            console.log("DOOOONE")
            sendEmailTxt(acc.email, "[⏰] Time's up!", `Your task (${msg.title}) for ${new Date(msg.epoch)} is for now!`)

            if(msg.webhook){
              const hook = new Webhook(msg.webhook);

              if(hook){
                const IMAGE_URL = 'https://i.imgur.com/hypeVWp.png';
                hook.setUsername('Planner');
                hook.setAvatar(IMAGE_URL);

                const embed = new MessageBuilder()
                .setTitle("[⏰] Time's up!")
                .setColor('#00b0f4')
                .setDescription(`Your task (${msg.title}) for ${new Date(msg.epoch)} is for now!`)
                .setTimestamp();

                hook.send(embed);
              }
            }
          }
        }, msg.epoch - new Date())
        
        fn({
          res: true
        })
      }
    }
  })
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
