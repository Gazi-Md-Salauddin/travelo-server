const express = require('express');
const app = express()
const port = 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require("dotenv");
const cors = require("cors");
require('dotenv').config()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const uri = process.env.MONGO_DB_URI;

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

    const database = client.db("travelo_db")
    const ticketCollection = database.collection("tickets")
    const bookingCollection = database.collection("bookings")


    app.get('/api/users', async (req, res) => {
            
            const cursor = usersCollection.find().skip(6);
            const result = await cursor.toArray();
            res.send(result);
        })






    app.get('/api/tickets', async (req, res) => {
  const result = await ticketCollection.find().toArray();
  res.send(result);
});


    app.get('/api/tickets', async (req, res) => {
  const status = req.query.status;

  const query = {};

  if (status) {
    query.status = status;
  }

  const result = await ticketCollection
    .find(query)
    .toArray();

  res.send(result);
});

    app.get('/api/tickets/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await ticketCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch ticket",
      error: error.message,
    });
  }
});
    
    app.post('/api/tickets', async (req, res) => {
      const ticket = req.body
      const newTicket = {
       ...ticket, 
        status: "pending",
        createdAt: new Date(),
      }
      const result = await ticketCollection.insertOne(newTicket)
      res.send(result)
    })

    app.patch('/api/tickets/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const result = await ticketCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
      },
    }
  );

  res.send(result);
});


    //Booking related apis

    //Get vendor requested bookings
    app.get('/api/bookings/vendor/:email', async (req, res) => {
  const email = req.params.email;

  const result = await bookingCollection
    .find({ vendorEmail: email })
    .toArray();

  res.send(result);
});

    //Update booking status
    app.patch('/api/bookings/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const result = await bookingCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
      },
    }
  );

  res.send(result);
});

    //create booking
    app.post('/api/bookings', async (req, res) => {
  const booking = req.body;

  const result = await bookingCollection.insertOne({
    ...booking,
    createdAt: new Date(),
  });

  res.send(result);
});


    

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);







app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})