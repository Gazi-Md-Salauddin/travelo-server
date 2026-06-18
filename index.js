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


    app.get('/api/users', async (req, res) => {
            
            const cursor = usersCollection.find().skip(6);
            const result = await cursor.toArray();
            res.send(result);
        })






    app.get('/api/tickets', async (req, res) => {
  const result = await ticketCollection.find().toArray();
  res.send(result);
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