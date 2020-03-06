const { ApolloServer, gql } = require("apollo-server");
const MongoClient = require('mongodb').MongoClient;
const { PubSub } = require('apollo-server');
const pubsub = new PubSub();
const url = 'mongodb+srv://upwork01satlasuser:lJx9gMcQ310X3AkK@cluster01-rinri.gcp.mongodb.net/test?retryWrites=true&w=majority';
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(function (err) {
  if (err) {
    console.log(err)
  } else {
    console.log("MongoDB was connected.");
    db = client.db("upwork");
  }
});


const typeDefs = gql`
  type Subscription {
    objects: [Object]
  }
  
  type Object {
    objectId: String!
    category: String
    text: String!
    number: Int!
    boolean: Boolean!
    createdAt: String
    updatedAt: String
  }

  type Query {
    objects: [Object]!
    objectsByCategories(category: [String]): [Object]
  }

  type Mutation {
    insertObject(objectId: String!, filter: [String]!, category: String!, text: String!, number: Int!, boolean: Boolean!, createdAt: String!): MutationResponse!
    updateObject(objectId: String!, filter: [String]! text: String!, number: Int!, boolean: Boolean!, updatedAt: String!): MutationResponse!
    deleteObject(objectId: String!, filter: [String]!): MutationResponse!
  }

  type MutationResponse {
    success: Boolean!
    message: String!
  }

`;  

const OBJECT_CHANGED = 'objects'

let mainFilter = {
  category: {  
    $in: ''
  }
}

const resolvers = {
  Subscription: {
    objects: {
      subscribe: () => pubsub.asyncIterator([OBJECT_CHANGED])
    }
  },
  Query: {
    objects: async () => {
      return await db.collection('Objects').find().toArray().then(res => { return res });
    },
    objectsByCategories: async (root, category) => {
      console.log(category);
      mainFilter.category.$in = category.category
      return await db.collection('Objects').find(mainFilter).toArray().then(res => { return res });  
    }
  },
  Mutation: {
    insertObject: async (root, args, context, info) => {
      const res = await db.collection('Objects').insertOne(args)
      if (res.insertedCount > 0) {
        mainFilter.category.$in = args.filter
        let objects = await db.collection('Objects').find(mainFilter).toArray().then(res => { return res });  
        await pubsub.publish(OBJECT_CHANGED, { objects: objects })
        return { success: true, message: 'Data was inserted.' }
      } else {
        return { success: false, message: 'Data was not inserted.' }
      }
    },
    updateObject: async (root, args, context, info) => {
      const filter = { objectId: args.objectId }
      const data = { 
        $set: {
          text: args.text,
          number: args.number,
          boolean: args.boolean,
          updated: args.updateAt
        } 
      }
      let res = await db.collection('Objects').updateOne(filter, data)
      if (res.modifiedCount > 0) {
        mainFilter.category.$in = args.filter
        let objects = await db.collection('Objects').find(mainFilter).toArray().then(res => { return res });  
        await pubsub.publish(OBJECT_CHANGED, { objects: objects })
        return { success: true, message: 'Data was updated.' }
      } else  {
        return { success: false, message: 'Data was not updated.' }
      }
    },
    deleteObject: async (root, args, context, info) => {
      const filter = { objectId: args.objectId }
      let res = await db.collection('Objects').deleteOne(filter)
      if (res.deletedCount > 0) {
        mainFilter.category.$in = args.filter
        let objects = await db.collection('Objects').find(mainFilter).toArray().then(res => { return res });  
        await pubsub.publish(OBJECT_CHANGED, { objects: objects })
        return { success: true, message: 'Data was deleted.' }
      } else {
        return { success: false, message: 'Data was not deleted.' }
      }
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers
});

server.listen(3000).then(({ url }) => console.log(`Server running at ${ url } and subscriptions at ${ server.subscriptionsPath }`));