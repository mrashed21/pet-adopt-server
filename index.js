const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET_KEY}`);
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "https://pet-adopt-web.netlify.app",
    "http://localhost:5173",
    "http://localhost:5174",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// verify token
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden! No token provided." });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) return res.status(403).send({ message: "Token is not valid." });
    req.decoded = decoded;
    next();
  });
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjfhp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("petAdoptDB");
    // genarate json token

    // jwt releted api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "9h",
      });
      res.send({ token });
    });

    // user collection
    const userCollection = database.collection("users");

    // save  a user in db
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      // check if user exists in db
      const isExist = await userCollection.findOne({ email: email });
      if (isExist) {
        return res.send(isExist);
      }
      const result = await userCollection.insertOne({
        ...user,
        role: "user",
      });
      res.send(result);
    });
    // get user by email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        if (user) {
          res.status(200).send({ role: user.role });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error fetching user role", error: error.message });
      }
    });

    // pet collection
    const petCollection = database.collection("pets");

    // Add Pet
    app.post("/pets/add", verifyToken, async (req, res) => {
      try {
        const {
          name,
          age,
          category,
          location,
          shortDescription,
          longDescription,
          imageUrl,
          userEmail,
        } = req.body;

        // Create pet document
        const newPet = {
          name: name.trim(),
          age,
          category: category.trim(),
          location: location.trim(),
          shortDescription: shortDescription.trim(),
          longDescription: longDescription.trim(),
          imageUrl: imageUrl.trim(),
          userEmail: userEmail.trim(),
          adopted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await petCollection.insertOne(newPet);

        res.status(201).json({
          message: "Pet added successfully",
          petId: result.insertedId,
          pet: newPet,
        });
      } catch (error) {
        console.error("Server error while adding pet:", error);
        res.status(500).json({
          message: "Failed to add pet",
          error: error.message,
        });
      }
    });

    // get all pets
    app.get("/pets", async (req, res) => {
      try {
        const { name, category, page = 1, limit = 9 } = req.query;
        const filters = { adopted: false };
        if (name) {
          filters.name = { $regex: name, $options: "i" };
        }
        if (category) {
          filters.category = category;
        }
        const pets = await petCollection
          .find(filters)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .toArray();
        const totalCount = await petCollection.countDocuments(filters);
        res.json({ pets, totalCount });
      } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).json({ message: "Failed to fetch pets", error });
      }
    });

    // get pet by id
    app.get("/pets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid pet ID" });
        }
        const petId = new ObjectId(id);
        const pet = await petCollection.findOne({ _id: petId });
        if (!pet) {
          return res.status(404).json({ message: "Pet not found" });
        }
        res.json(pet);
      } catch (error) {
        console.error("Error fetching pet by ID:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch pet", error: error.message });
      }
    });

    // get pet by email
    app.get("/pet/me/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      try {
        const query = { userEmail: email };
        const pets = await petCollection.find(query).toArray();
        if (!pets || pets.length === 0) {
          return res
            .status(404)
            .send({ message: "No pets found for this user" });
        }
        res.send(pets);
      } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // update pet by id
    app.put("/pets/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedPet = req.body;
      try {
        const result = await petCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { ...updatedPet, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Pet not found" });
        }
        res.json({ message: "Pet updated successfully" });
      } catch (error) {
        console.error("Error updating pet:", error);
        res
          .status(500)
          .json({ message: "Error updating pet", error: error.message });
      }
    });

    // delete pet by id
    app.delete("/pets/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Pet not found" });
        }
        res.send({ message: "Pet deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Error deleting pet", error });
      }
    });

    // Update pet's adopted status
    app.patch("/pets/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { adopted } = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid pet ID",
          });
        }
        const result = await petCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              adopted,
              updatedAt: new Date(),
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Pet not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Pet status updated successfully",
        });
      } catch (error) {
        console.error("Error updating pet status:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update pet status",
          error: error.message,
        });
      }
    });

    // Update pet adoption status reject
    app.patch("/pet-reject/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { adopted } = req.body;
      if (typeof adopted !== "boolean") {
        return res
          .status(400)
          .json({ message: "Invalid 'adopted' value. Must be a boolean." });
      }
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid pet ID format." });
      }
      try {
        const petId = new ObjectId(id);
        const result = await petCollection.updateOne(
          { _id: petId },
          { $set: { adopted, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Pet not found." });
        }
        res
          .status(200)
          .json({ message: "Pet adoption status updated successfully." });
      } catch (error) {
        console.error("Error updating pet status:", error); // Log the exact error
        res.status(500).json({
          message: "Failed to update pet status.",
          error: error.message,
        });
      }
    });

    // adoption collection
    const adoptionCollection = database.collection("adoptions");

    // Create new adoption request and update pet status
    app.post("/adoptions", async (req, res) => {
      try {
        const adoptionData = {
          ...req.body,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await adoptionCollection.insertOne(adoptionData);
        res.status(201).json({
          success: true,
          message: "Adoption request submitted successfully!",
          adoptionId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating adoption:", error);
        res.status(500).json({
          success: false,
          message: "Failed to submit adoption request",
          error: error.message,
        });
      }
    });

    // Get adoptions by user email for receive
    app.get("/adoptions/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const adoptions = await adoptionCollection
          .find({ petOwnerEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(adoptions);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching adoptions",
          error: error.message,
        });
      }
    });
    // get adoptions by user email for send
    app.get("/adoptions/send/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const adoptions = await adoptionCollection
          .find({ adopterEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(adoptions);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching adoptions",
          error: error.message,
        });
      }
    });
    // delete by id
    app.delete("/adoptions/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await adoptionCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Adoption not found" });
        }
        res.json({ message: "Adoption deleted successfully" });
      } catch (error) {
        console.error("Error deleting adoption:", error);
        res.status(500).json({
          message: "Error deleting adoption",
          error: error.message,
        });
      }
    });
    // Update adoption request by id
    app.patch("/adoptions/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid adoption ID format." });
      }
      try {
        const result = await adoptionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Adoption not found" });
        }
        res.json({ message: "Adoption status updated successfully" });
      } catch (error) {
        console.error("Error updating adoption status:", error);
        res.status(500).json({
          message: "Failed to update adoption status",
          error: error.message,
        });
      }
    });

    // Donation collection
    const donationCollection = database.collection("donations");

    // Add a new donation campaign
    app.post("/donations/add", verifyToken, async (req, res) => {
      try {
        const {
          title,
          shortDescription,
          longDescription,
          goalAmount,
          imageUrl,
          userEmail,
          lastDate,
        } = req.body;
        const newDonation = {
          title: title.trim(),
          shortDescription: shortDescription.trim(),
          longDescription: longDescription.trim(),
          goalAmount,
          imageUrl: imageUrl.trim(),
          userEmail: userEmail.trim(),
          raisedAmount: 0,
          paused: false,
          donators: [],
          createdAt: new Date(),
          lastDate: lastDate.trim(),
        };

        const result = await donationCollection.insertOne(newDonation);
        res.status(201).json({
          message: "Donation campaign added successfully",
          donationId: result.insertedId,
          donation: newDonation,
        });
      } catch (error) {
        console.error("Error adding donation campaign:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Get all donation campaigns with pagination
    app.get("/donations", async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;
        const donations = await donationCollection
          .find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .toArray();
        const totalCount = await donationCollection.countDocuments();
        res.json({ donations, totalCount });
      } catch (error) {
        console.error("Error fetching donations:", error);
        res.status(500).json({ message: "Failed to fetch donations" });
      }
    });

    // Get a specific donation campaign by ID
    app.get("/donations/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        const donation = await donationCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!donation) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }
        res.json(donation);
      } catch (error) {
        console.error("Error fetching donation campaign:", error);
        res.status(500).json({ message: "Failed to fetch donation campaign" });
      }
    });

    app.patch("/donations/update/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const {
          title,
          shortDescription,
          longDescription,
          goalAmount,
          imageUrl,
          lastDate,
          updatedAt,
        } = req.body;

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ message: "Invalid donation ID format" });
        }

        // Get existing donation
        const existingDonation = await donationCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingDonation) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }

        // Create update object
        const updateData = {
          title: title.trim(),
          shortDescription: shortDescription.trim(),
          longDescription: longDescription.trim(),
          goalAmount: Number(goalAmount),
          imageUrl: imageUrl.trim(),
          lastDate,
          updatedAt,
        };

        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }

        res.json({
          message: "Donation campaign updated successfully",
          donation: { ...existingDonation, ...updateData },
        });
      } catch (error) {
        console.error("Error updating donation campaign:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Get donations by user email
    app.get("/donations/user/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const donations = await donationCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(donations);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching donations",
          error: error.message,
        });
      }
    });

    // Pause or unpause a donation campaign
    app.patch("/donations/pause/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { paused } = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { paused } }
        );
        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }
        res.json({
          message: `Donation campaign ${
            paused ? "paused" : "unpaused"
          } successfully`,
        });
      } catch (error) {
        console.error("Error toggling donation pause state:", error);
        res.status(500).json({ message: "Failed to update donation campaign" });
      }
    });

    // Get donators for a specific donation campaign
    app.get("/donations/donators/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        const donation = await donationCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!donation) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }
        res.json(donation.donators || []);
      } catch (error) {
        console.error("Error fetching donators:", error);
        res.status(500).json({ message: "Failed to fetch donators" });
      }
    });
    // Get donations where user has donated
    app.get("/my-donations/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const donations = await donationCollection
          .find({
            "donators.email": email,
          })
          .toArray();

        res.json(donations);
      } catch (error) {
        console.error("Error fetching user donations:", error);
        res.status(500).json({
          message: "Failed to fetch donations",
          error: error.message,
        });
      }
    });

    // Process refund request
    app.post("/donations/refund/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { userEmail, amount } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }

        // Find the donation campaign
        const donation = await donationCollection.findOne({
          _id: new ObjectId(id),
          "donators.email": userEmail,
        });

        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }

        // Remove the donation from the campaign
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $pull: { donators: { email: userEmail } },
            $inc: { raisedAmount: -amount },
          }
        );

        if (result.modifiedCount === 0) {
          return res.status(400).json({ message: "Failed to process refund" });
        }

        res.json({ message: "Refund processed successfully" });
      } catch (error) {
        console.error("Error processing refund:", error);
        res.status(500).json({
          message: "Server error",
          error: error.message,
        });
      }
    });
    // -----------------------------

    app.post("/donations/:id/donate", verifyToken, async (req, res) => {
      const { amount, paymentMethodId, donorEmail, donorName } = req.body;
      const { id } = req.params;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid donation amount" });
      }
      if (!paymentMethodId) {
        return res
          .status(400)
          .json({ message: "Payment method ID is required" });
      }
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          metadata: {
            donationId: id,
            donorEmail,
            donorName,
          },
        });
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { raisedAmount: amount },
            $push: {
              donators: {
                email: donorEmail,
                name: donorName,
                amount,
                paymentMethodId,
                donatedAt: new Date(),
              },
            },
          }
        );
        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Donation campaign not found" });
        }
        res.status(200).json({
          success: true,
          clientSecret: paymentIntent.client_secret,
          message: "Donation successful, raised amount updated",
        });
      } catch (error) {
        console.error("Error processing donation:", error);
        res.status(400).json({
          success: false,
          message: error.message || "Failed to process donation",
        });
      }
    });

    app.get("/donations/recommended/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid donation ID" });
        }
        const campaigns = await donationCollection
          .aggregate([
            { $match: { _id: { $ne: new ObjectId(id) }, paused: false } },
            { $sample: { size: 3 } },
          ])
          .toArray();
        if (!campaigns.length) {
          return res
            .status(404)
            .json({ message: "No recommended campaigns found" });
        }
        res.json(campaigns);
      } catch (error) {
        console.error("Error fetching recommended donations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch recommended donations" });
      }
    });

    // for newsletter
    const newsletterCollection = database.collection("newsletter");
    app.post("/newsletter", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
        const existingUser = await newsletterCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
        }
        await newsletterCollection.insertOne({ email });
        res.json({ message: "Email added to newsletter successfully" });
      } catch (error) {
        console.error("Error adding newsletter email:", error);
        res.status(500).json({ message: "Failed to add email to newsletter" });
      }
    });

    // Middleware for admin verification
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        if (user.role !== "admin") {
          return res
            .status(403)
            .send({ message: "Access denied! Admin only." });
        }
        next();
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal server error", error: error.message });
      }
    };

    // for admin
    //  Get All Users
    app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await userCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Make User Admin
    app.put("/admin/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const userId = req.params.id;
        const { role } = req.body;
        const filter = { _id: new ObjectId(userId) };
        const update = { $set: { role } };
        const result = await userCollection.updateOne(filter, update);
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({
          message: role === "admin" ? "User made admin" : "Admin role removed",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: error.message });
      }
    });
    // get all pets
    app.get("/admin/pets", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const pet = await petCollection.find({}).toArray();
        res.json(pet);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // all donation

    app.get("/admin/donation", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const donations = await donationCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.json(donations);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching donations",
          error: error.message,
        });
      }
    });
    // delete donation by id
    app.delete(
      "/admin/donations/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid donation ID" });
          }
          const result = await donationCollection.deleteOne({
            _id: new ObjectId(id),
          });
          if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Donation not found" });
          }
          res.json({ message: "Donation deleted successfully" });
        } catch (error) {
          console.error("Error deleting donation:", error);
          res.status(500).json({
            message: "Failed to delete donation",
            error: error.message,
          });
        }
      }
    );

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pet server is running");
});

app.listen(port, () => {
  console.log(`Server is running on PORT ${port}`);
});
