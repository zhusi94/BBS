const express = require('express')
const path        = require('path')
const fs          = require('fs')
const bodyParse   = require('body-parser')
const cookieParse = require('cookie-parser')
const sqlite      = require('sqlite')
const multer      = require('multer')
const svgCaptcha  = require('svg-captcha')


const port = 80

const upload = multer({dest:path.join(__dirname,'./user-uploaded')})
const app    = express()

var dbPromise = sqlite.open(path.join(__dirname,'./bbs.db'),{Promise})
var sessions  = {}



app.locals.pretty = true

app.set('views', path.join(__dirname,'./templates'))

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})

// app.use('/favicon.ico',express.static(path.join(__dirname,'./static')))  图标

app.use('/',express.static(path.join(__dirname,'./static/dist')))
app.use('/js',express.static(path.join(__dirname,'./static/js')))
app.use('/css',express.static(path.join(__dirname,'./static/css')))

app.use('/bootstrap',express.static(path.join(__dirname,'./bootstrap')))
app.use('/avatars',express.static('./user-uploaded'))
app.use(cookieParse('dawdada'))
app.use(bodyParse.urlencoded())
app.use(bodyParse.json())


app.use(function sessionMiddleware (req,res,next){
  if(!req.cookies.sessionId){
    res.cookie('sessionId',Math.random().toString(16).substring(2))
  }
  next()
})

app.use(async (req,res,next) => {
  req.user = await db.get('SELECT * FROM users WHERE id=?',req.signedCookies.userId)
  next()
})

app.get('/', async (req, res, next) => {
  var posts = await db.all('SELECT * FROM posts')
  res.render('index.pug', {posts,user:req.user})
})

app.get('/api/posts',async(req,res,next)=>{
  var posts = await db.all(`
  SELECT 
    posts.id, posts.content, posts.userId, posts.title, posts.timestamp, users.name,users.avatar 
  FROM posts 
  JOIN users 
  ON posts.userId=users.id`)
  res.json(posts)
})

app.get('/api/post/:postId',async(req,res,next)=>{
  var post = await db.all(`SELECT 
    posts.*, users.name, users.avatar
    FROM posts JOIN users 
    ON posts.userId = users.id
    
    WHERE posts.id=?`,req.params.postId)

  res.json(post)
})

app.get('/api/user/:userId', async (req,res,next) => {
  var user = await db.get('SELECT id, name, avatar FROM users WHERE id=?',req.params.userId)
  
  var userPosts    = await db.all('SELECT * FROM posts where userId=?',req.params.userId)
  var userComments = await db.all('SELECT comments.*,title as postTitle FROM comments JOIN posts ON comments.postId=posts.id WHERE comments.userId=?',req.params.userId)

  res.json({
    user,
    userPosts,
    userComments
  })
})

app.get('/api/comments/:postId', async (req,res,next) => {
  var comments = await db.all('SELECT comments.*,name, avatar FROM comments JOIN users ON comments.userId=users.id WHERE postId=?',req.params.postId)
  res.json(comments)
})

app.get('/api/userinfo', async (req,res,next)=>{

  if(req.user){
    res.json(req.user)
  } else {
    res.status(401).json({
      code: -1,
      msg : 'unauthorized'
    })
  }
})

app.post("/api/register",upload.single('avatar'),async (req,res)=>{

  let user = await db.get("select * from users where name = ?",req.body.username)
  if(user){
    res.status(403).end()
  }else{
    await db.run("insert into users(name,password,avatar) values(?,?,?)",req.body.username,req.body.password,req.file.filename)
    res.json("注册成功")
  }
})


app.route('/register')
 
  .post(upload.single('avatar'), async (req,res,next) => {
    var user = await db.get('SELECT * FROM users WHERE name=?',req.body.username)
    debugger
    if(user){
      res.end('username has been registered')
    } else {
      await db.run('INSERT INTO users (name, password, avatar) VALUES (?,?,?)',req.body.username,req.body.password,req.file && req.file.filename)
      res.end('ok')
    }
  })

app.route('/login')
  
  .post(async (req,res,next) => {
    if(req.body.captcha.toLowerCase() != sessions[req.cookies.sessionId].captcha){
      res.status(403).json({
        code: -1,
        msg : 'captcha not correct'
      })
    }
    var user = await db.get('SELECT id, name FROM users WHERE name=? AND password=?',req.body.username,req.body.password)
    if(user){
      res.cookie('userId',user.id,{
        signed  : true,
        httpOnly: true
      })
      res.json(user)
    } else {
      res.status(403).json({
        code: -1,
        msg : '用户名或密码错误'
      })
    }
  })

app.get('/captcha', async (req,res,next) => {
  var num = Math.random() * 10
  if(num > 5){
    var captcha = svgCaptcha.create()
  
  } else {
    var captcha = svgCaptcha.createMathExpr()
  }
  sessions[req.cookies.sessionId] = {
    captcha: captcha.text.toLowerCase()
  }
  res.type('svg')
  res.status(200).send(captcha.data)
})



app.get('/logout',(req,res,next)=>{
  res.clearCookie('userId')
  res.redirect('/')
})

app.route('/add-post')
  .get((req,res,next)=> {
    res.render('add-post.pug',{user:req.user})
  })
  .post(async (req,res,next)=>{
    if(req.signedCookies.userId){
      await db.run('INSERT INTO posts (userId, title, content, timestamp) VALUES (?,?,?,?)',req.signedCookies.userId,req.body.title,req.body.content,Date.now())
      var newPost = await db.get('SELECT * FROM posts ORDER BY timestamp DESC LIMIT 1')
      res.json(newPost)
      // res.redirect('/post/' + newPost.id)
    } else {
      res.writeHead(200,{'Content-Type': 'text/html; charset=UTF-8'})
      res.end(`<a href="/login">您还未登录，点击登录</a>
        <a href="/">或者返回首页</a>
      `)
    }
  })

app.get('/user/:userId',async (req,res,next) => {
  
  if(req.user) {
    var userPosts    = await db.all('SELECT * FROM posts where userId=?',req.params.userId)
    var userComments = await db.all('SELECT comments.*,title as postTitle FROM comments JOIN posts ON comments.postId=posts.id WHERE comments.userId=?',req.params.userId)
    res.render('user.pug',{
      user    : req.user,
      posts   : userPosts,
      comments: userComments
    })
  } else {
    res.render('user.pug',{user:req.user})
  }
})

app.get('/post/:postId', async (req, res, next) => {
  var post = await db.get('SELECT posts.*, name, avatar FROM posts JOIN users ON posts.userId=users.id WHERE posts.id=?',req.params.postId)
  if (post) {
    var comments = await db.all('SELECT comments.*,name, avatar FROM comments JOIN users ON comments.userId=users.id WHERE postId=?',req.params.postId)
    res.render('post.pug', {post,comments,user:req.user})
  } else {
    res.status(404).render('post-not-find.pug')
  }
})

app.get('/delete-post/:postId', async (req,res,next) => {
  var post = await db.get('SELECT * FROM posts WHERE id=?',req.params.postId)
  if(post && req.user){
    if(post.userId == req.user.id){
      await db.run('DELETE FROM posts WHERE id=?',post.id)
      res.status(200).end("ok")
    } else {
      req.status(403).end()
    }
  }
})

app.get('/delete-comment/:commentsId', async (req,res,next) => {
  var comment = await db.get('SELECT * FROM comments WHERE id=?',req.params.commentsId)
  if(comment && req.user){
    if(comment.userId == req.user.id){
      await db.run('DELETE FROM comments WHERE id=?',comment.id)
      res.status(200).end("ok")
    } else {
      req.status(403).end()
    }
  }
})

app.post('/add-comment',async (req,res,next) => {
  console.log(req.body)
  if(req.signedCookies.userId ){
    if(req.body.content.trim() !== '' ){
      await db.run(`
        INSERT INTO comments (postId,userId,content,timestamp)
        VALUES (?,?,?,?)
      `,req.body.postId,req.signedCookies.userId,req.body.content,Date.now())

      var comment = await db.get('SELECT * FROM comments JOIN users ON comments.userID=users.id ORDER BY timestamp DESC LIMIT 1')
      res.json(comment)
    } else {
      // res.writeHead(200,{'Content-Type': 'text/html; charset=UTF-8'})
      // res.end(`
      // <a href="/post/${req.body.postId}">您还未登录，点击返回</a>
      // <span>或者</span>
      // <a href="/login">点击登录</a>
      // `)
      res.end('评论不能为空')
    }
  } else {
    // res.writeHead(200,{'Content-Type': 'text/html; charset=UTF-8'})
    // res.end(`<a href="/post/${req.body.postId}">评论无效，点击返回</a>`)
    res.end('您还未登录')
  }
})
;

(async function () {
  db = await dbPromise;
  app.listen(port, () => {
    console.log('server listening on port', port)
  })
}())