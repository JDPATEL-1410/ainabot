const { MongoClient } = require('mongodb');

class Collection {
    constructor(parent, collectionName) {
        this.parent = parent;
        this.collectionName = collectionName;
    }

    get col() {
        if (!this.parent.db) {
            throw new Error(`Database not connected. Call connect() before accessing ${this.collectionName}`);
        }
        return this.parent.db.collection(this.collectionName);
    }

    async findOne(query) {
        const processedQuery = this._processQuery(query);
        return await this.col.findOne(processedQuery);
    }

    async insert_one(document) {
        // Ensure id is present or mapped to _id if needed, 
        // but routes use 'id' string normally.
        await this.col.insertOne(document);
    }

    async update_one(query, updateData, options = {}) {
        const processedQuery = this._processQuery(query);
        // MongoDB updateData usually already has $set, $inc etc.
        // But our routes might pass them directly or with $set
        await this.col.updateOne(processedQuery, updateData, options);
    }

    find(query) {
        const processedQuery = this._processQuery(query);
        let cursor = this.col.find(processedQuery);

        return {
            cursor: cursor,
            sort: function (key, direction) {
                this.cursor = this.cursor.sort({ [key]: direction });
                return this;
            },
            limit: function (n) {
                this.cursor = this.cursor.limit(n);
                return this;
            },
            skip: function (n) {
                this.cursor = this.cursor.skip(n);
                return this;
            },
            to_list: async function (length) {
                if (length) this.cursor = this.cursor.limit(length);
                return await this.cursor.toArray();
            }
        };
    }

    async count_documents(query) {
        const processedQuery = this._processQuery(query);
        return await this.col.countDocuments(processedQuery);
    }

    async delete_many(query) {
        const processedQuery = this._processQuery(query);
        await this.col.deleteMany(processedQuery);
    }

    async delete_one(query) {
        const processedQuery = this._processQuery(query);
        await this.col.deleteOne(processedQuery);
    }

    async update_many(query, updateData) {
        const processedQuery = this._processQuery(query);
        await this.col.updateMany(processedQuery, updateData);
    }

    _processQuery(query) {
        // Translate some common patterns if needed, though MongoDB driver 
        // mostly matches what our routes send since they were designed after motor.
        const q = { ...query };
        // In our SQL version we had 'display_phone.$regex'. 
        // MongoDB driver handles this naturally.
        return q;
    }
}

class SQLDatabase { // Kept the name for compatibility with helpers.js
    constructor(dbUrl) {
        this.client = new MongoClient(dbUrl);
        this.db = null;
        this.collections = {};
    }

    async connect() {
        if (!this.db) {
            await this.client.connect();
            this.db = this.client.db(); // Uses db name from URL
            console.log("Connected to MongoDB");
        }
    }

    getCollection(name) {
        if (!this.collections[name]) {
            this.collections[name] = new Collection(this, name);
        }
        return this.collections[name];
    }

    async create_all() {
        // MongoDB creates collections on the fly. No-op or connect.
        await this.connect();
    }

    async close() {
        await this.client.close();
    }
}

module.exports = { SQLDatabase };
