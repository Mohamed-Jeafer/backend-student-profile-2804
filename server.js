const express = require('express');
const axios = require('axios').default;
const Redis = require("redis");


const app = express();
const redisClient = Redis.createClient();

app.use(express.urlencoded({ extended: false }))
app.use(express.json())
const DEFAULT_EXPIRATION = 3600


app.get('/ping', (req, res) => {
    res.json("success : true")
    res.status(200)
})

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

function callAPI(tags, sortBy, direction) {
    let api = 'https://api.hatchways.io/assessment/blog/posts?'

    api = api.concat('tag=' + tags)
    if (sortBy !== undefined) {
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

app.post('/posts', async (req, res) => {
    const { tags, sortBy, direction } = req.query

    if (tags) {
        const tagArray = tags.split(',')
        for (tag of tagArray) {
            let api = callAPI(tag, sortBy, direction)
            var posts = await getOrSetCache(api, async () => {
                const { data } = await axios.get(api)
                return data
            })
        }

        res.send(Object.values(posts))
    } else {
        res.status(400)
        res.json({ "error": "Tags parameter is required" })
    }
})

function getOrSetCache(key, cb) {
    return new Promise((resolve, reject) =>{
        redisClient.get(key, async (error, data) => {
            if (error) reject(error)
            if (data != null) return resolve (mergePosts(JSON.parse(data).posts))
            const freshData = await cb()
            redisClient.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshData))
            resolve(mergePosts(freshData.posts))
        })
    })
}

function mergePosts (allposts) {
    let posts = {}
    for (post of allposts) {
        posts[post.id] = post
    }
    return posts
}

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