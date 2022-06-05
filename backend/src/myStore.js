var express = require('express');
var myStoreRouter = express.Router();
const crypto= require('crypto')
const { randomBytes, createHash } = require('crypto')
const { MongoClient } = require('mongodb');
const { resolve } = require('path');
const axios = require('axios');
const collection = require('./Collection.json');
const { default: Stripe } = require('stripe');
const stripe = require('stripe')('');
const url = "";
var keyArray = {};
var invalidResponse = {
    "error": "Invalid Credentials",
    "message": {
        "string": "error"
    }
}

var notFoundResponse = {
    "error": "User Not Found in the Database",
    "message": {
        "string": "error"
    }
}

var errResponse = {
    "error": "Internal Server Failure",
    "message": {
        "string": "error"
    }
}

var responsesuc = {
    "success": "Email and Message Added to the database",
    "message": {
        "string": "added to mongo kongo"
    }
}

var responsesuccess = {
    "success": "Order Successfull",
    "message": {
        "string": "added to mongo kongo"
    }
}

var responsesuccessCart = {
    "success": "Added to cart",
    "message": {
        "string": "added to mongo kongo"
    }
}

myStoreRouter.post('/login', function(req, res) {
    const body = req.body;
    try {
        MongoClient.connect(url, function(err, db) {
            if (err) throw err;
            var dbo = db.db("MyStore");
            var n = new Promise((resolve, reject) => {
                dbo.collection("Users").find({}).toArray(function (err, result) {
                    new Promise((resolve, reject) => {
                        for(var i = 0;i<result.length;i++) {
                            if(result[i].username===body.username) {
                                decode(body.password, result[i]).then(rer => {
                                    if(rer.valid) {
                                        var local = rer
                                        local.password = ''
                                        res.send(local)
                                        resolve('Varification Successful')
                                    } else {
                                        console.log(new Date(), 'Invalid Credentials')
                                        reject(invalidResponse)
                                    }
                                }).catch((e) => console.log(new Date(), e))
                                break;
                            } else if(i===result.length-1) reject(notFoundResponse)
                        }
                    }).then((r) => resolve(r)).catch((e) => {
                        reject(e)
                    })
            })}).then((r) => {console.log(new Date(), r)}).catch((e) => {
                try {
                    res.status(403).send(e)
                } catch(e) {
                    console.log(new Date(), 'Internal Server Error')
                }
            })
          }); 
    } catch(e) {
        console.log(new Date(), e)
    }
    
});

myStoreRouter.post('/logon', async function(req, res) {
    const body = req.body;
    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MyStore");
        var n = new Promise(() => {
            dbo.collection("Users").find({}).toArray(function (err, result) {
                var flag = true;
                result.map((r) => {
                    if(r.username===body.username) flag = false
                })
                if(flag) {
                    encode(body.password).then((pass) => {
                        body.password = pass;
                        dbo.collection("Users").insertOne(body, function(err, resp) {
                            if (err) res.status(500).send(errResponse);
                            console.log(body)
                            console.log(new Date(), "syer "+ body.email + " user logged on");
                            res.send(body)
                            createCart({
                                username: body.username,
                                cart: body.cart
                            })
                            db.close();
                        });
                    })
                } else {
                    errResponse.error = 'Email already linked to another account';
                    res.status(500).send(errResponse)
                }
        })})
      }); 
});  


myStoreRouter.post('/addtocart', async function(req, res) {
    try {
        MongoClient.connect(url, function(err, db) {
            if (err) throw err;
            var db = db.db("MyStore");
                var n = new Promise((resolve, reject) => {
                    db.collection("Users").find({'username': req.body.email}).forEach(function(x){
                        console.log('---------------------------------------------------------')
                        console.log(x)
                        x.cart = req.body.cart
                        console.log('---------------------------------------------------------')
                        console.log(x)
                    db.collection("Users").replaceOne({_id:x._id},x)
                }).then((r) => {
                    res.send(responsesuccessCart)
                })
            })})
    } catch(r) {
        console.log(r)
    }
});

myStoreRouter.get('/getCollection', async function(req, res) {
    try {
        console.log(new Date(), ' Collection Sent Sucessfully')
        res.json(collection)
    } catch(r) {
        console.log(r)
    }
});

myStoreRouter.post('/create-checkout-session', async function(req, res) {
    try {
        console.log(new Date(), ' Starting Checkout Procedure ')
        var key = crypto.randomBytes(16).toString('hex');
        keyArray[key] = req.body
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: req.body.cart.map((item) =>{
                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name
                        },
                        unit_amount: item.price[item.size]*100
                    },
                    quantity: item.quantity
                }
            }),
            success_url: 'https://mycanvasstore.netlify.app/?paymentsuccess:'+key,
            cancel_url: 'https://mycanvasstore.netlify.app/?paymentfailed:'+key
        })
        res.json({
            url: session.url
        })
        console.log(new Date(), ' Checkout Procedure Completed')
    } catch(r) {
        console.log(r)
    }
});

myStoreRouter.post('/check-session-key', async function(req, res) {
    try {
        console.log(new Date(), ' Checking key ')
        var flag = false;
        if(req.body.key in keyArray) flag = true;
     
        if(flag) {
            const body = keyArray[req.body.key];
            try {
                MongoClient.connect(url, function(err, db) {
                    if (err) throw err;
                    var db = db.db("MyStore");
                    var n = new Promise((resolve, reject) => {
                        db.collection("Users").find({'username': body.userinfo.email}).forEach(function(x){
                            console.log('---------------------------------------------------------')
                            console.log(x)
                            var ud = x.orders
                            ud.push(body);
                            x.orders = ud;
                            console.log('---------------------------------------------------------')
                            console.log(x)
                        db.collection("Users").replaceOne({_id:x._id},x)
                    }).then((r) => {
                        delete keyArray[body.key]
                        res.json({
                            key: body.key,
                            valid: true
                        })
                    }).catch((e) => {
                        res.status(500).send(errResponse)
                    })
                })
                }); 
            } catch(e) {
                console.log(new Date(), e)
            } 
            
        } else {
            res.status(403).send(errResponse)
        }
        console.log(new Date(), ' Key checked')
    } catch(r) {
        res.status(403).send(errResponse)
        console.log(r)
    }
});

myStoreRouter.post('/checkout-order', function(req, res) {
    const body = req.body;
    try {
        MongoClient.connect(url, function(err, db) {
            if (err) throw err;
            var db = db.db("MyStore");
            var n = new Promise((resolve, reject) => {
                db.collection("Users").find({'username': body.email}).forEach(function(x){
                    console.log('---------------------------------------------------------')
                    console.log(x)
                    var ud = x.orders
                    ud.push(body.cart);
                    x.orders = ud;
                    console.log('---------------------------------------------------------')
                    console.log(x)
                db.collection("Users").replaceOne({_id:x._id},x)
            }).then((r) => {
                res.send(responsesuccess)
            })
        })
          }); 
    } catch(e) {
        console.log(new Date(), e)
    } 
});

function createCart(body) {
    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MyStore");
        var n = new Promise(() => {
            dbo.collection("Cart").insertOne(body, function(err, resp) {
                if (err) console.log(err)
                db.close();
            });
        })})
}

const getUsers = () => {
    
    return new Promise(dbo.collection("Users").find({}).toArray(function (err, result) {
        if (err) {
            reject(err);
        } else {
            resolve(result)
        }
    }))
}

const encode = (password) => {
    return new Promise((resolve, reject) => {
        var enckey = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, enckey, 64, (err, derivedKey) => {
            if(err) reject(err)
            resolve(enckey+':'+derivedKey.toString('hex'))
        })
    })
}

const decode = (password, retrieved) => {
    return new Promise((resolve, reject) => {
        var enckey = retrieved.password.split(':')[0];
        crypto.scrypt(password, enckey, 64, (err, derivedKey) => {
            if(err) reject(err)
            if(retrieved.password.split(':')[1]===derivedKey.toString('hex')) {
                retrieved.valid=true
                resolve(retrieved)
            }
            else {
                retrieved.valid=false
                resolve(retrieved)
            }
        })
    })
}

module.exports = myStoreRouter;