
import * as functions from 'firebase-functions'
import { adminDB, firestoreDB, validateFirebaseIdToken } from '../../data/index'
import * as _ from 'lodash'
import { Circle } from '../../domain/circles/circle'
import * as moment from 'moment'
import * as express from 'express'
import * as bodyParser from 'body-parser'

const cookieParser = require('cookie-parser')()

/**
 * Handle on user create
 */
export const onUserCreate = functions.auth.user().onCreate((user) => {
    return new Promise<void>((resolve, reject) => {
        const followingCircle = new Circle()
        followingCircle.creationDate = moment.utc().valueOf()
        followingCircle.name = `Following`
        followingCircle.ownerId = user.uid
        followingCircle.isSystem = true
        return firestoreDB.collection(`users`).doc(user.uid).collection(`circles`).add({ ...followingCircle })
            .then((result) => {
                resolve()
            }).catch(reject)

    })
})

/**
 * Intialize express server to handle http(s) requests
 */
const app = express()
const cors = require('cors')({ origin: true })
app.disable('x-powered-by')
app.use(cors)
app.use(bodyParser.json())
app.use(cookieParser)
app.use(validateFirebaseIdToken)

/**
 * Routes
 */

export const auth = functions.https.onRequest(app)