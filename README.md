# BrunoRAG

**Live at [brunorag.com](https://brunorag.com)**

## Abstract

BrunoRAG is a search service that allows users to query for courses using natural language, using vector embeddings to match with the courses database. Using a distributed model allows nodes to distribute both data preprocessing steps (such as crawling and indexing) and live query operations. The result is a fast and effective chat service which allows users to find courses through nearly any factor: interests, timeslots, and even workload, special topics, and exam formats.

## Data

We use the Courses@Brown (CAB) API to collect ~131,000 course section records spanning Summer 2016 through Spring 2026, representing ~10,000 unique offerings. We also use Critical Review data from 2019 to 2025.

A two-step pipeline queries a search endpoint for listings, then fetches a details endpoint per CRN for descriptions and metadata. Critical Review data, when available, is joined to the dataset via CRN, which the API already exposes per section.

## Supported Queries

Natural-language queries are supported by an instruct-tuned model. With pre-query filtering, the system automatically extracts filters from your phrasing. The following queries are all validated to produce helpful and informative responses:

- semantics in philosophy
- english classes <10 hours/wk MWF
- engineering class with hands-on component
- TuTh systems-heavy CS courses
- Linguistics courses with paper writing
- Cities and urban architecture practicum
- History of music
- intensive drama courses

**Filterable fields:** department, days of the week, semester/year, permission required, average/max weekly hours, course rating, professor rating, class size, instructor name.

## Methodology

At seed time, course data is crawled, converted to structured text, embedded with metadata such as meeting days, times, and professor, and distributed across nodes using consistent hashing. At query time, the user's input is embedded through the OpenAI API to capture semantic similarity to course data. A pre-query model extracts keyword features such as days of the week and professor which are applied programmatically. The query embedding and extracted filters are sent to nodes to retrieve local top-K matches. After filtering, each node uses FAISS to index relevant embeddings and return the most similar results; the coordinator then merges these into a global top-K set, which is passed to the post-query model as context for the final response. A coordinator-layer LRU cache serves repeated queries, bypassing the embedding and retrieval pipeline.

## UI

The frontend is a single-page HTML/JS interface served by the Node server. It displays both an AI-generated summary citing specific courses and the raw course cards with sections, schedules, ratings, and descriptions.

