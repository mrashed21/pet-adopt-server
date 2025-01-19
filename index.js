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

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }

    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();
    const database = client.db("petAdoptDB");

    // genarate json token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_SECRET, {
        expiresIn: "365d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear json token
    app.post("/logout", async (req, res) => {
      try {
        res.clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        });

        return res.status(200).send({ success: true });
      } catch (error) {
        return res.status(500).send({ message: "Server error" });
      }
    });

    // user collection
    const userCollection = database.collection("users");

    // add user on database
    app.post("/users/add", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await userCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          // Update existing user's information
          await userCollection.updateOne(
            { email: user.email },
            {
              $set: {
                name: user.name,
                photoURL: user.photoURL,
                role: user.role || "user",
                updatedAt: new Date(),
              },
            }
          );
          return res.status(200).send({ message: "User information updated" });
        }

        // Create new user
        const newUser = {
          ...user,
          role: user.role || "user",
          createdAt: new Date(),
        };
        const result = await userCollection.insertOne(newUser);
        res.status(201).send({ message: "User added successfully", result });
      } catch (error) {
        res.status(500).send({
          message: "Error processing user data",
          error: error.message,
        });
      }
    });

    // pet collection
    const petCollection = database.collection("pets");

    // Add Pet
    app.post("/pets/add", async (req, res) => {
      // try {
      //   const {
      //     name,
      //     age,
      //     category,
      //     location,
      //     shortDescription,
      //     longDescription,
      //     imageUrl,
      //   } = req.body;

      //   // Comprehensive input validation
      //   const validationErrors = [];

      //   if (!name || typeof name !== "string" || name.trim().length === 0) {
      //     validationErrors.push("Valid pet name is required");
      //   }

      //   if (!age || typeof age !== "number" || age < 0) {
      //     validationErrors.push("Valid pet age is required");
      //   }

      //   if (
      //     !category ||
      //     typeof category !== "string" ||
      //     category.trim().length === 0
      //   ) {
      //     validationErrors.push("Valid pet category is required");
      //   }

      //   if (
      //     !location ||
      //     typeof location !== "string" ||
      //     location.trim().length === 0
      //   ) {
      //     validationErrors.push("Valid pet location is required");
      //   }

      //   if (
      //     !shortDescription ||
      //     typeof shortDescription !== "string" ||
      //     shortDescription.trim().length === 0 ||
      //     shortDescription.length > 150
      //   ) {
      //     validationErrors.push(
      //       "Valid short description is required (max 150 characters)"
      //     );
      //   }

      //   if (
      //     !longDescription ||
      //     typeof longDescription !== "string" ||
      //     longDescription.trim().length === 0
      //   ) {
      //     validationErrors.push("Valid long description is required");
      //   }

      //   if (
      //     !imageUrl ||
      //     typeof imageUrl !== "string" ||
      //     !imageUrl.startsWith("http")
      //   ) {
      //     validationErrors.push("Valid image URL is required");
      //   }

      //   if (validationErrors.length > 0) {
      //     return res.status(400).json({
      //       message: "Validation failed",
      //       errors: validationErrors,
      //     });
      //   }

      //   const newPet = {
      //     name: name.trim(),
      //     age,
      //     category: category.trim(),
      //     location: location.trim(),
      //     shortDescription: shortDescription.trim(),
      //     longDescription: longDescription.trim(),
      //     imageUrl,
      //     adopted: false,
      //     createdAt: new Date(),
      //     updatedAt: new Date(),
      //     userEmail,
      //   };

      //   const result = await petCollection.insertOne(newPet);

      //   res.status(201).json({
      //     message: "Pet added successfully",
      //     petId: result.insertedId,
      //     pet: newPet,
      //   });
      // } catch (error) {
      //   console.error("Server error while adding pet:", error);
      //   res.status(500).json({
      //     message: "Failed to add pet",
      //     error: error.message,
      //   });
      // }
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

        // Input validation
        const validationErrors = [];

        if (!name?.trim() || typeof name !== "string") {
          validationErrors.push("Valid pet name is required");
        }

        if (!Number.isInteger(age) || age < 0) {
          validationErrors.push("Valid pet age is required");
        }

        if (!category?.trim() || typeof category !== "string") {
          validationErrors.push("Valid pet category is required");
        }

        if (!location?.trim() || typeof location !== "string") {
          validationErrors.push("Valid pet location is required");
        }

        if (
          !shortDescription?.trim() ||
          typeof shortDescription !== "string" ||
          shortDescription.length > 150
        ) {
          validationErrors.push(
            "Valid short description is required (max 150 characters)"
          );
        }

        if (!longDescription?.trim() || typeof longDescription !== "string") {
          validationErrors.push("Valid long description is required");
        }

        if (
          !imageUrl?.trim() ||
          typeof imageUrl !== "string" ||
          !imageUrl.startsWith("http")
        ) {
          validationErrors.push("Valid image URL is required");
        }

        if (!userEmail?.trim() || typeof userEmail !== "string") {
          validationErrors.push("Valid user email is required");
        }

        if (validationErrors.length > 0) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationErrors,
          });
        }

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
    app.get("/pet/me/:email", async (req, res) => {
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
    app.put("/pets/:id", async (req, res) => {
      const { id } = req.params;
      const updatedPet = req.body;

      try {
        // Ensure age is a valid number
        if (updatedPet.age !== undefined) {
          updatedPet.age = parseInt(updatedPet.age);
        }

        // Perform additional validation
        const validationErrors = [];
        if (!updatedPet.name || typeof updatedPet.name !== "string") {
          validationErrors.push("Pet name is required and must be a string.");
        }
        if (
          updatedPet.age !== undefined &&
          (isNaN(updatedPet.age) || updatedPet.age < 0)
        ) {
          validationErrors.push("Age must be a non-negative number.");
        }
        if (!updatedPet.imageUrl || !updatedPet.imageUrl.startsWith("http")) {
          validationErrors.push("Valid image URL is required.");
        }

        // If there are validation errors, return early
        if (validationErrors.length > 0) {
          return res
            .status(400)
            .json({ message: "Validation failed", errors: validationErrors });
        }

        // Update the pet in the database
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
    app.delete("/pets/:id", async (req, res) => {
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
    app.patch("/pet/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { adopted } = req.body;

        // Validate pet ID
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid pet ID" });
        }

        // Update pet's adopted status
        const result = await petCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              adopted: adopted,
              updatedAt: new Date(),
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Pet not found" });
        }

        if (result.modifiedCount === 0) {
          return res
            .status(400)
            .json({ message: "No changes made to pet status" });
        }

        res.json({
          message: "Pet adoption status updated successfully",
          adopted: adopted,
        });
      } catch (error) {
        console.error("Error updating pet adoption status:", error);
        res.status(500).json({
          message: "Failed to update pet adoption status",
          error: error.message,
        });
      }
    });

    // adoption collection
    const adoptionCollection = database.collection("adoptions");

    // Create new adoption request and update pet status
    app.post("/adopt", async (req, res) => {
      try {
        const adoptionData = {
          ...req.body,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Start a session for the transaction
        const session = client.startSession();

        try {
          await session.withTransaction(async () => {
            // Insert the adoption request
            const adoptionResult = await adoptionCollection.insertOne(
              adoptionData,
              { session }
            );

            // Update the pet's adopted status to "pending"
            const petUpdateResult = await petCollection.updateOne(
              { _id: new ObjectId(adoptionData.petId) },
              {
                $set: {
                  adopted: "pending",
                  updatedAt: new Date(),
                },
              },
              { session }
            );

            if (!adoptionResult.acknowledged || !petUpdateResult.acknowledged) {
              throw new Error("Failed to process adoption request");
            }
          });

          await session.endSession();
          res.status(201).json({
            success: true,
            message: "Adoption request submitted successfully",
          });
        } catch (error) {
          await session.endSession();
          throw error;
        }
      } catch (error) {
        console.error("Error processing adoption request:", error);
        res.status(500).json({
          success: false,
          message: "Failed to process adoption request",
          error: error.message,
        });
      }
    });

    // Get adoptions by user email
    app.get("/adoptions/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const adoptions = await adoptionCollection
          .find({ email })
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

    // donation collection
    const donationCollection = database.collection("donations");

    // Add a new donation campaign
    app.post("/donations/add", async (req, res) => {
      try {
        const { title, description, goalAmount, imageUrl, userEmail } = req.body;
    
        const errors = [];
        if (!title?.trim() || typeof title !== "string") {
          errors.push("Valid title is required");
        }
        if (!description?.trim() || typeof description !== "string") {
          errors.push("Valid description is required");
        }
        if (!imageUrl?.trim() || !imageUrl.startsWith("http")) {
          errors.push("Valid image URL is required");
        }
        if (!userEmail?.trim() || typeof userEmail !== "string") {
          errors.push("Valid user email is required");
        }
        if (typeof goalAmount !== "number" || goalAmount <= 0) {
          errors.push("Valid goal amount is required");
        }
    
        if (errors.length > 0) {
          return res.status(400).json({ message: "Validation failed", errors });
        }
    
        const newDonation = {
          title: title.trim(),
          description: description.trim(),
          goalAmount,
          imageUrl: imageUrl.trim(),
          userEmail: userEmail.trim(),
          raisedAmount: 0,
          createdAt: new Date(),
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
    

    // Get all donation campaigns
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

    // Update a donation campaign by ID
    app.put("/donations/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { title, description, goalAmount, imageUrl } = req.body;

        const updates = {};
        if (title) updates.title = title.trim();
        if (description) updates.description = description.trim();
        if (goalAmount) updates.goalAmount = parseFloat(goalAmount);
        if (imageUrl) updates.imageUrl = imageUrl.trim();
        updates.updatedAt = new Date();

        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }
        res.json({ message: "Donation campaign updated successfully" });
      } catch (error) {
        console.error("Error updating donation campaign:", error);
        res.status(500).json({ message: "Failed to update donation campaign" });
      }
    });

    // Delete a donation campaign by ID
    app.delete("/donations/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await donationCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Donation campaign not found" });
        }
        res.json({ message: "Donation campaign deleted successfully" });
      } catch (error) {
        console.error("Error deleting donation campaign:", error);
        res.status(500).json({ message: "Failed to delete donation campaign" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pet server is running");
});

app.listen(port, () => {
  console.log(`Server is running on PORT ${port}`);
});
