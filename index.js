const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    optionalSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjfhp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
    // await client.connect();
    const database = client.db("petAdoptDB");
    const userCollection = database.collection("users");

    // Add user to database
    app.post("/users/add", async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(200).send({ message: "User already exists" });
      }
      const newUser = {
        ...user,
        role: user.role || "user",
        createdAt: new Date(),
      };
      const result = await userCollection.insertOne(newUser);
      res.status(201).send({ message: "User added successfully", result });
    });

    const petCollection = database.collection("pets");

    // Add Pet API with improved validation and error handling
    app.post("/pets/add", async (req, res) => {
      try {
        const {
          name,
          age,
          category,
          location,
          shortDescription,
          longDescription,
          imageUrl,
        } = req.body;

        // Comprehensive input validation
        const validationErrors = [];

        if (!name || typeof name !== "string" || name.trim().length === 0) {
          validationErrors.push("Valid pet name is required");
        }

        if (!age || typeof age !== "number" || age < 0) {
          validationErrors.push("Valid pet age is required");
        }

        if (
          !category ||
          typeof category !== "string" ||
          category.trim().length === 0
        ) {
          validationErrors.push("Valid pet category is required");
        }

        if (
          !location ||
          typeof location !== "string" ||
          location.trim().length === 0
        ) {
          validationErrors.push("Valid pet location is required");
        }

        if (
          !shortDescription ||
          typeof shortDescription !== "string" ||
          shortDescription.trim().length === 0 ||
          shortDescription.length > 150
        ) {
          validationErrors.push(
            "Valid short description is required (max 150 characters)"
          );
        }

        if (
          !longDescription ||
          typeof longDescription !== "string" ||
          longDescription.trim().length === 0
        ) {
          validationErrors.push("Valid long description is required");
        }

        if (
          !imageUrl ||
          typeof imageUrl !== "string" ||
          !imageUrl.startsWith("http")
        ) {
          validationErrors.push("Valid image URL is required");
        }

        if (validationErrors.length > 0) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationErrors,
          });
        }

        const newPet = {
          name: name.trim(),
          age,
          category: category.trim(),
          location: location.trim(),
          shortDescription: shortDescription.trim(),
          longDescription: longDescription.trim(),
          imageUrl,
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
    // //  get all pet
    //     app.get("/pets", async (req, res) => {
    //       try {
    //         const pets = await petCollection.find().toArray();
    //         res.json({ pets });
    //       } catch (error) {
    //         console.error("Server error while fetching pets:", error);
    //         res.status(500).json({
    //           message: "Failed to fetch pets",
    //           error: error.message,
    //         });
    //       }
    //     });
    // app.get("/pets", async (req, res) => {
    //   try {
    //     const { name, category } = req.query;

    //     // Create a filter object
    //     const filter = {};

    //     // If a name is provided, perform a case-insensitive search
    //     if (name) {
    //       filter.name = { $regex: name, $options: "i" };
    //     }

    //     // If a category is provided, filter by category
    //     if (category) {
    //       filter.category = category;
    //     }

    //     // Fetch pets from the database with the filter
    //     const pets = await petCollection.find(filter).sort({ createdAt: -1 }).toArray();
    //     res.json({ pets });
    //   } catch (error) {
    //     console.error("Server error while fetching pets:", error);
    //     res.status(500).json({
    //       message: "Failed to fetch pets",
    //       error: error.message,
    //     });
    //   }
    // });
    app.get("/pets", async (req, res) => {
      try {
        const { name, category, page = 1, limit = 9 } = req.query;
        const filters = { adopted: false };

        if (name) {
          filters.name = { $regex: name, $options: "i" }; // Case-insensitive search
        }
        if (category) {
          filters.category = category;
        }

        const pets = await petCollection
          .find(filters)
          .sort({ createdAt: -1 }) // Sort by date descending
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

        // Validate ID
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid pet ID" });
        }

        const petId = new ObjectId(id);
        const pet = await petCollection.findOne({ _id: petId });

        if (!pet) {
          return res.status(404).json({ message: "Pet not found" });
        }

        res.json(pet); // Return the pet object directly
      } catch (error) {
        console.error("Error fetching pet by ID:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch pet", error: error.message });
      }
    });

    console.log("Connected to MongoDB and server ready!");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pet Adopt server is running");
});

app.listen(port, () => {
  console.log(`Server is running on PORT ${port}`);
});
