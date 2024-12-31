const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://car-rental-client.web.app",
      "https://car-rental-client.firebaseapp.com",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.user = decoded;

    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ybs8l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. Successfully connected to MongoDB!");

    const carCollection = client.db("carsDB").collection("cars");
    const bookCollection = client.db("carsDB").collection("bookedCars");

    // JWT
    app.post("/jwt-access", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "2d",
      });
      // console.log(token);

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/log-out", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Cars collection
    app.get("/cars", async (req, res) => {
      const findData = carCollection.find();
      const convertToArray = await findData.toArray();
      res.send(convertToArray);
    });

    app.get("/recent-listings", async (req, res) => {
      const findAll = carCollection.find({});
      const result = await findAll.sort({ dateAdded: -1 }).limit(8).toArray();

      res.send(result);
    });

    app.get("/car/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const findResult = await carCollection.findOne(query);
      res.send(findResult);
    });

    app.get("/my-cars", verifyToken, async (req, res) => {
      const { email, sortType } = req.query;
      const decodedEmail = req.user?.email;

      if (email !== decodedEmail) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      const query = { "userDetails.email": email };
      let sorted = {};
      if (sortType == "Date Added: Newest First") {
        sorted = { dateAdded: -1 };
      }
      if (sortType == "Date Added: Oldest First") {
        sorted = { dateAdded: 1 };
      }
      if (sortType == "Price: Lowest First") {
        sorted = { price: 1 };
      }
      if (sortType == "Price: Highest First") {
        sorted = { price: -1 };
      }

      const findData = carCollection.find(query).sort(sorted);
      const convertToArray = await findData.toArray();
      res.send(convertToArray);
    });

    app.get("/available-cars", async (req, res) => {
      const { sortType, search } = req.query;
      let searchTerm = {};

      //  if(search){
      //   searchTerm = {model: {$regex: search, $options: "i"}};
      //  }

      if (search) {
        searchTerm = { location: { $regex: search, $options: "i" } };
      }

      let sorted = {};
      if (sortType == "Date Added: Newest First") {
        sorted = { dateAdded: -1 };
      }
      if (sortType == "Date Added: Oldest First") {
        sorted = { dateAdded: 1 };
      }
      if (sortType == "Price: Lowest First") {
        sorted = { price: 1 };
      }
      if (sortType == "Price: Highest First") {
        sorted = { price: -1 };
      }

      const findData = carCollection.find(searchTerm).sort(sorted);
      const convertToArray = await findData.toArray();
      res.send(convertToArray);
    });

    app.post("/cars", async (req, res) => {
      const carsData = req.body;
      // console.log(carsData);

      const insertResult = await carCollection.insertOne(carsData);
      res.send(insertResult);
    });

    app.patch("/update-car/:id", async (req, res) => {
      const carInfo = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updateInfo = {
        $set: {
          model: carInfo?.model,
          price: carInfo?.price,
          availability: carInfo?.availability,
          registrationNumber: carInfo?.registrationNumber,
          features: carInfo?.features,
          description: carInfo?.description,
          image: carInfo?.image,
          location: carInfo?.location,
        },
      };

      const updateResult = await carCollection.updateOne(query, updateInfo);

      res.send(updateResult);
    });

    app.delete("/delete-car/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const deleteResult = await carCollection.deleteOne(query);
      res.send(deleteResult);
    });

    // Booked Cars collection
    app.get("/booked-cars", async (req, res) => {
      const findData = bookCollection.find();
      const result = await findData.toArray();
      res.send(result);
    });

    app.get("/my-bookings", verifyToken, async (req, res) => {
      const email = req.query.email;
      const userEmail = req.user?.email;

      if (email !== userEmail) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      let query = { "userInfo.email": email };

      const findData = bookCollection.find(query);
      const result = await findData.toArray();
      res.send(result);
    });

    app.post("/booked-cars", async (req, res) => {
      const bookedData = req.body;
      const insertResult = await bookCollection.insertOne(bookedData);

      const query = {
        email: bookedData.userInfo?.email,
        carId: bookedData?.carId,
      };

      const existedData = await carCollection.findOne(query);
      if (existedData) {
        return res
          .status(400)
          .send({ message: "You have already booked the car" });
      }

      const findCar = { _id: new ObjectId(bookedData.carId) };
      const carData = await carCollection.findOne(findCar);

      if (carData && typeof carData.bookingCount !== "number") {
        await carCollection.updateOne(findCar, { $set: { bookingCount: 0 } });
      }

      const updateCount = {
        $inc: { bookingCount: 1 },
      };

      await carCollection.updateOne(findCar, updateCount);

      res.send(insertResult);
    });

    app.patch("/cancel-status/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updateInfo = {
        $set: {
          status: "Canceled",
        },
      };

      const result = await bookCollection.updateOne(query, updateInfo);
      res.send(result);
    });

    app.patch("/modify-dates/:id", async (req, res) => {
      const dates = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const modifyDates = {
        $set: {
          bookingStartDate: dates?.bookingStartDate,
          bookingEndDate: dates?.bookingEndDate,
        },
      };

      const result = await bookCollection.updateOne(query, modifyDates);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car rental server is running...");
});

app.listen(port, () => {
  console.log(`The Car rental server is running on Port: ${port}`);
});
