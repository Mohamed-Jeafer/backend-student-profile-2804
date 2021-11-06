const express = require('express');
const axios = require('axios').default;
const Redis = require("redis");


const app = express();
const redisClient = Redis.createClient();

app.use(express.urlencoded({ extended: false }))
app.use(express.json())
const DEFAULT_EXPIRATION = 3600

// this path returns success with status code 200
app.get('/ping', (req, res) => {
    res.json("success : true")
    res.status(200)
})

// this function checks the validity of the query
function checkValidity(query, reqQuery) {
    let validation = false
    if (query === 'sortBy') {
        if (reqQuery === 'id' || reqQuery === 'likes' || reqQuery === 'reads' || reqQuery === 'popularity') {
            return validation = true
        }
    }
    if (query === 'direction') {
        if (reqQuery === 'desc' || reqQuery === 'asc') {
            return validation = true
        }
    }
    return validation
}

// this function construct the url to be called using the parameters given in the query
function callAPI(tags, sortBy, direction) {
    let api = 'https://api.hatchways.io/assessment/blog/posts?'

    api = api.concat('tag=' + tags)  // there is no need to verify tag
    if (sortBy !== undefined) {  // sortBy is ignored if it is empty
        if (checkValidity('sortBy', sortBy)) { 
            api = api.concat('&sortBy=' + sortBy)
        } else {
            res.status(400)
            res.json({ 'error': 'sortBy parameter is invalid' })
        }
    }
    if (direction !== undefined) {
        if (checkValidity('direction', direction)) {
            api = api.concat('&direction=' + direction)
        } else {
            res.status(400)
            res.json({ 'error': 'direction parameter is invalid' })
        }
    }
    return api
}

// this function gets or sets the data received from/into the redis database
function getOrSetCache(key, cb) {
    return new Promise((resolve, reject) =>{
        redisClient.get(key, async (error, data) => {
            if (error) reject(error) 
            // if the is url requested is already in the database, the posts will be returned
            if (data != null) return resolve (mergePosts(JSON.parse(data).posts))
            // if the data is not available, callback function will make an api call and return the data
            const freshData = await cb()
            // freshdata is stored with and expiration into the redis server
            redisClient.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshData))
            resolve(mergePosts(freshData.posts))
        })
    })
}

// this function merges all the posts using key:value where the post ID is the key. repeating posts will be overwritten
// because they have the same id
function mergePosts (allposts) {
    let posts = {}
    for (post of allposts) {
        posts[post.id] = post
    }
    return posts
}

// this post accepts queries, calls the given api, and send the posts to the users
app.post('/posts', async (req, res) => {
    const { tags, sortBy, direction } = req.query

    if (tags) { // if tag is not given (undefined) the app will error out
        const tagArray = tags.split(',')
        for (tag of tagArray) {  // if more than one tag is given, they will be split into an array
            let api = callAPI(tag, sortBy, direction)
            // the reason why i am sending the url, because every api call will return different result
            var posts = await getOrSetCache(api, async () => { 
                const { data } = await axios.get(api) // this is the callback function in case data is not in cache
                return data
            })
        }
        res.send(Object.values(posts)) // since posts includes id and post, only posts are sent 
    } else {
        res.status(400)
        res.json({ "error": "Tags parameter is required" })
    }
})

app.listen(3000, () => {
    console.log('The server is listening to port 3000')
})







// redisClient.get(api, async (error, posts) => {
//     console.log(posts)
//     if (error) console.error(error)
//     if (posts != null) {
//         let retrivedPosts = JSON.parse(posts)
//         for (post of retrivedPosts) {
//             console.log('each post', post)
//             responseObj[post.id] = post
//         }
//     } else {
//         try {
//             const { data } = await axios.get(api)
//             for (post of data.posts) {
//                 responseObj[post.id] = post
//             }
//         }
//         catch (error) {
//             res.status(404)
//             console.log(error)
//         }
//     }
// })