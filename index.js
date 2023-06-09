const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json())

// verify JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.header.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()

    })
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrkqnje.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const instructorsCollection = client.db("musicianDB").collection("instructors");
        const classesCollection = client.db("musicianDB").collection("classes");
        const usersCollection = client.db("musicianDB").collection("users");
        // API to get jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })
        // user related API
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const result = await usersCollection.insertOne(newUser);
            res.send(result)
        })
        // instructors related API
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray()
            res.send(result)
        })
        // classes related API 
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray()
            res.send(result)
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Summer Camp Server Is Running')
})
app.listen(port, () => {
    console.log('Summer Camp server is running on port', port);
})
