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

    const userDatabase = client.db("travelo"); 
    const usersCollection = userDatabase.collection("user");
    const sessionCollection = userDatabase.collection("session");


    //verification related
    const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;

    console.log("AUTH HEADER:", authHeader);

    if (!authHeader) {
        console.log("STEP 1 FAILED");
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const token = authHeader.split(' ')[1];

    console.log("TOKEN:", token);

    const session = await sessionCollection.findOne({
       token: token
    });

    console.log("SESSION:", session);

    if (!session) {
        console.log("STEP 2 FAILED");
        return res.status(401).send({ message: 'unauthorized access' })
    }
    
      const user = await usersCollection.findOne({
    _id: session.userId,
  });

  if (!user) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }

      req.user = user
    next();
}


    // must be used after verifyToken middleware
const verifyUser = async (req, res, next) => {
    if (req.user?.role !== 'user') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}

// must be used after verifyToken middleware
const verifyVendor = async (req, res, next) => {
    if (req.user?.role !== 'vendor') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}

// must be used after verifyToken middleware
const verifyAdmin = async (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}


    
    app.get('/api/users', async (req, res) => {
            
            const cursor = usersCollection.find().skip(1);
            const result = await cursor.toArray();
            res.send(result);
        })


    


    app.get('/api/tickets', async (req, res) => {
  const result = await ticketCollection.find().toArray();
  res.send(result);
});


    app.get('/api/tickets', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    const query = {};

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const tickets = await ticketCollection
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await ticketCollection.countDocuments(query);

    res.send({
      tickets,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTickets: total,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tickets",
      error: error.message,
    });
  }
});


    //all ticket details 
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
    
    app.post('/api/tickets', verifyToken, verifyVendor, async (req, res) => {
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

    //update ticket
    app.put("/api/tickets/:id", verifyToken, verifyVendor, async (req, res) => {
  const id = req.params.id;
  const { _id, ...updatedTicket} = req.body;

  const result = await ticketCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: updatedTicket,
    }
  );

  res.send(result);
});


    //delete ticket
    app.delete("/api/tickets/:id", verifyToken, verifyVendor, async (req, res) => {
  const id = req.params.id;

  const result = await ticketCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});
    
    //Booking related apis

    //Get vendor requested bookings
    app.get('/api/bookings/vendor/:email', verifyToken, verifyVendor, async (req, res) => {
  const email = req.params.email;

  const result = await bookingCollection
    .find({ vendorEmail: email })
    .toArray();

  res.send(result);
});

    //Update booking status
    app.patch('/api/bookings/:id', verifyToken, verifyVendor, async (req, res) => {
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

    //User related api
    app.get('/api/bookings/user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    const result = await bookingCollection
      .find({ userEmail: email })
      .toArray();
    
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
});


    //manage user in admin dashboard
    app.get("/api/users", async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});

    app.patch("/api/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  const { role } = req.body;

  const result = await usersCollection.updateOne(
    {
      _id: new ObjectId(req.params.id),
    },
    {
      $set: {
        role,
        isFraud: true,
      }
    }
  );

  res.send(result);
});
    

//For profile update

    app.patch("/api/users/:id", async (req, res) => {
  const id = req.params.id;
      
  const { name, image } = req.body;

  try {
    const query = {
      $or: [
        { id: id },
        { _id: id },
        { _id: new ObjectId(id) }
      ]
    };
    const result = await usersCollection.updateOne(
      query,
      {
        $set: {
          name,
          image,
        },
      }
    );

    res.send(result);
  } catch (error) {
    
    res.status(400).send({ error: "Invalid ID format" });
  }
});

    //payment related api
    app.patch("/api/bookings/:id/pay", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const transactionId = req.body
    const booking = await bookingCollection.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).send({
        message: "Booking not found",
      });
    }

    // status paid
    await bookingCollection.updateOne(
      {
        _id: new ObjectId(bookingId),
      },
      {
        $set: {
          status: "paid",
          paymentDate: new Date(),
          transactionId: transactionId
        },
      }
    );

    // reduce ticket quantity
    await ticketCollection.updateOne(
      {
        _id: new ObjectId(booking.ticketId),
      },
      {
        $inc: {
          quantity: -booking.bookingQuantity,
        },
      }
    );

    res.send({
      success: true,
      message: "Payment completed and ticket quantity updated",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});


    
app.get('/api/transactions/user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    
    const result = await bookingCollection
      .find({ 
        userEmail: email, 
        status: "paid" 
      })
      .sort({ paymentDate: -1 }) 
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
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