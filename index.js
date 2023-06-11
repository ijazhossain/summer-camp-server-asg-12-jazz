const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json())

// verify JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorizeddd access' })
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
        const cartCollection = client.db("musicianDB").collection("carts");
        const paymentCollection = client.db("musicianDB").collection("payments");

        // API to get jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            // console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })
        // cart related API
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result);
        })

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email
            // console.log(email)
            if (!email) {
                res.send([])
            }
            const query = { studentEmail: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/carts', async (req, res) => {
            const myClass = req.body;
            const result = await cartCollection.insertOne(myClass);
            res.send(result)
        })

        // user related API
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
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

            const result = await classesCollection.find({ status: 'approved' }).sort({ enrolledStudents: -1 }).toArray()
            res.send(result)
        })
        // payment related API
        app.get('/paidClasses', async (req, res) => {
            const email = req.query.email
            // console.log(email)
            if (!email) {
                res.send([])
            }
            const query = { studentEmail: email }
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray()
            res.send(result)
        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment);
            const insertResult = await paymentCollection.insertOne(payment);
            const cartDeletedResult = await cartCollection.deleteOne({ _id: new ObjectId(payment.cartId) })

            const query = { _id: new ObjectId(payment.classId) }
            const selectedClass = await classesCollection.findOne(query);
            // console.log(selectedClass);
            if (selectedClass) {
                if (selectedClass.availableSeats > 0) {

                    const filter = { _id: new ObjectId(payment.classId) }
                    const seatUpdate = await classesCollection.updateOne(filter,
                        { $inc: { availableSeats: -1, enrolledStudents: 1 } }
                    );
                    return res.send({
                        insertResult,
                        cartDeletedResult,
                        seatUpdate
                    })
                }
            }
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

