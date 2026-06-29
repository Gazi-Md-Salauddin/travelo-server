const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require("dotenv");
const cors = require("cors");
require('dotenv').config();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let ticketCollection;
let bookingCollection;
let usersCollection;
let sessionCollection;

async function run() {
  app.use(async (req, res, next) => {
    try {
      if (!ticketCollection || !bookingCollection || !usersCollection || !sessionCollection) {
        await client.connect();

        const database = client.db("travelo_db");
        ticketCollection = database.collection("tickets");
        bookingCollection = database.collection("bookings");

        const userDatabase = client.db("travelo"); 
        usersCollection = userDatabase.collection("user");
        sessionCollection = userDatabase.collection("session");

        console.log("MongoDB Re-connected successfully!");
      }
      next();
    } catch (error) {
      console.error("Database middleware connection error:", error);
      res.status(500).send({ message: "Database connection failed", error: error.message });
    }
  });

  // Verification Related Middleware
  const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;
    console.log("AUTH HEADER:", authHeader);

    if (!authHeader) {
        console.log("STEP 1 FAILED");
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split(' ')[1];
    console.log("TOKEN:", token);

    const session = await sessionCollection.findOne({ token: token });
    console.log("SESSION:", session);

    if (!session) {
        console.log("STEP 2 FAILED");
        return res.status(401).send({ message: 'unauthorized access' });
    }
    
    const user = await usersCollection.findOne({ _id: session.userId });

    if (!user) {
      return res.status(401).send({ message: "unauthorized access" });
    }

    req.user = user;
    next();
  };

  const verifyUser = async (req, res, next) => {
      if (req.user?.role !== 'user') {
          return res.status(403).send({ message: 'forbidden access' });
      }
      next();
  };

  const verifyVendor = async (req, res, next) => {
      if (req.user?.role !== 'vendor') {
          return res.status(403).send({ message: 'forbidden access' });
      }
      next();
  };

  const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== 'admin') {
          return res.status(403).send({ message: 'forbidden access' });
      }
      next();
  };

  // ==================== API ROUTES ====================
  
  app.get("/api/tickets", async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 6;

      const { status, from, to, transportType, sort } = req.query;
      const query = {};

      if (status) query.status = status;
      if (from) query.from = { $regex: from, $options: "i" };
      if (to) query.to = { $regex: to, $options: "i" };
      if (transportType) query.transportType = transportType;

      let sortOption = {};
      if (sort === "low") sortOption.price = 1;
      if (sort === "high") sortOption.price = -1;

      const tickets = await ticketCollection
        .find(query)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const totalTickets = await ticketCollection.countDocuments(query);

      res.send({
        tickets,
        currentPage: page,
        totalPages: Math.ceil(totalTickets / limit),
        totalTickets,
      });
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch tickets", error: error.message });
    }
  });

  app.get("/api/advertisements", async (req, res) => {
    try {
      const result = await ticketCollection
        .find({ status: "approved", isAdvertised: true })
        .limit(6)
        .toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch advertisements" });
    }
  });

  app.get('/api/tickets/:id', verifyToken, verifyUser, async (req, res) => {
    try {
      const id = req.params.id;
      const result = await ticketCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch ticket", error: error.message });
    }
  });

  app.post('/api/tickets', verifyToken, verifyVendor, async (req, res) => {
    const ticket = req.body;
    const newTicket = { ...ticket, status: "pending", createdAt: new Date() };
    const result = await ticketCollection.insertOne(newTicket);
    res.send(result);
  });

  app.patch('/api/tickets/:id', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const result = await ticketCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
    res.send(result);
  });

  app.put("/api/tickets/:id", verifyToken, verifyVendor, async (req, res) => {
    const id = req.params.id;
    const { _id, ...updatedTicket } = req.body;
    const result = await ticketCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedTicket });
    res.send(result);
  });

  app.delete("/api/tickets/:id", verifyToken, verifyVendor, async (req, res) => {
    const id = req.params.id;
    const result = await ticketCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  app.get("/api/admin/advertise-tickets", verifyToken, verifyAdmin, async (req, res) => {
    const result = await ticketCollection.find({ status: "approved" }).toArray();
    res.send(result);
  });

  app.patch("/api/admin/advertise-tickets/:id", verifyToken, verifyAdmin, async (req, res) => {
    const { advertise } = req.body;
    if (advertise) {
      const count = await ticketCollection.countDocuments({ isAdvertised: true });
      if (count >= 6) {
        return res.status(400).send({ message: "Maximum 6 tickets can be advertised" });
      }
    }
    const result = await ticketCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isAdvertised: advertise } });
    res.send(result);
  });

  app.get('/api/bookings/vendor/:email', verifyToken, verifyVendor, async (req, res) => {
    const email = req.params.email;
    const result = await bookingCollection.find({ vendorEmail: email }).toArray();
    res.send(result);
  });

  app.patch('/api/bookings/:id', verifyToken, verifyVendor, async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const result = await bookingCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
    res.send(result);
  });

  app.post('/api/bookings', async (req, res) => {
    const booking = req.body;
    const result = await bookingCollection.insertOne({ ...booking, createdAt: new Date() });
    res.send(result);
  });

  app.get("/api/revenue-overview/:email", verifyToken, verifyVendor, async (req, res) => {
    try {
      const email = req.params.email;
      const ticketsAdded = await ticketCollection.countDocuments({ vendorEmail: email });
      const paidBookings = await bookingCollection.find({ vendorEmail: email, status: "paid" }).toArray();
      const ticketsSold = paidBookings.reduce((sum, booking) => sum + Number(booking.bookingQuantity || 0), 0);
      const totalRevenue = paidBookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);

      res.send({ ticketsAdded, ticketsSold, totalRevenue });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  });

  app.get('/api/bookings/user/:email', async (req, res) => {
    try {
      const email = req.params.email;
      const result = await bookingCollection.find({ userEmail: email }).toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch bookings", error: error.message });
    }
  });

  app.get("/api/users", async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  app.patch("/api/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
    const { role } = req.body;
    const result = await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role, isFraud: true } });
    res.send(result);
  });

  app.patch("/api/users/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const { name, image } = req.body;
    try {
      const query = { $or: [{ id: id }, { _id: id }, { _id: new ObjectId(id) }] };
      const result = await usersCollection.updateOne(query, { $set: { name, image } });
      res.send(result);
    } catch (error) {
      res.status(400).send({ error: "Invalid ID format" });
    }
  });

  app.patch("/api/bookings/:id/pay", async (req, res) => {
    try {
      const bookingId = req.params.id;
      const transactionId = req.body;
      const booking = await bookingCollection.findOne({ _id: new ObjectId(bookingId) });

      if (!booking) return res.status(404).send({ message: "Booking not found" });

      await bookingCollection.updateOne({ _id: new ObjectId(bookingId) }, { $set: { status: "paid", paymentDate: new Date(), transactionId: transactionId } });
      await ticketCollection.updateOne({ _id: new ObjectId(booking.ticketId) }, { $inc: { quantity: -booking.bookingQuantity } });

      res.send({ success: true, message: "Payment completed and ticket quantity updated" });
    } catch (error) {
      res.status(500).send({ success: false, error: error.message });
    }
  });

  app.get('/api/transactions/user/:email', async (req, res) => {
    try {
      const email = req.params.email;
      const result = await bookingCollection.find({ userEmail: email, status: "paid" }).sort({ paymentDate: -1 }).toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch transactions", error: error.message });
    }
  });

  console.log("Pinged your deployment. You successfully connected to MongoDB!");
}


run().catch(console.dir);

// CATCH-ALL ROUTE FOR MISSING PATHS
app.use((req, res, next) => {
  res.status(404).send({ message: `Route ${req.originalUrl} not found on this server.` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong on the server!", error: err.message });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
