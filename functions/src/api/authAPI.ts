
import * as functions from 'firebase-functions'
import * as jwt from 'jsonwebtoken'
import * as rq from 'request-promise'
import { SocialError } from '../domain/common/socialError'
import * as bcrypt from 'bcrypt'

const secureKey = require('../config/secureKey.json')
const {privateKey, publicKey} = secureKey

const gmailEmail = functions.config().gmail.email
const appName = functions.config().setting.appname
const secretKey = functions.config().recaptcha.secretkey
const saltRounds = 10

/**
 * Sign Json Web Token
 */
const signJWT = (payload: Object, expiresIn: string | number = '12h') => {
return new Promise((resolve, reject) => {
    const signOptions = {
        issuer:  gmailEmail,
        subject:  appName,
        expiresIn,
        algorithm:  'RS256'
       }
    
     jwt.sign(payload, privateKey, signOptions, (error, token) => {
         if (error) {
             reject(error)
         } else {
             resolve(token)
         }
     } )

})
}

/**
 * Verify Json Web Token
 */
const verifyJWT = (token: string) => {
    return new Promise<any>((resolve, reject) => {
        return jwt.verify(token, publicKey, (error: any, decoded: any) => {
            if (error) {
                reject(new SocialError('verifyJWT/invalidToken', error))
            } else {
                resolve(decoded)
            }
        })
    })
}

/**
 * Verify captcha
 */
const verifyCaptcha = async (gReCaptcha: string, remoteIpAddress: string) => {
    if (gReCaptcha === undefined || gReCaptcha === '' || gReCaptcha === null) {
        throw new SocialError('ServerError/NullCaptchaValue', 'Please select captcha first')
    }

    const verificationURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + secretKey + '&response=' + gReCaptcha + '&remoteip=' + remoteIpAddress
    const options = {
        uri: verificationURL,
        json: true // Automatically parses the JSON string in the response
    }
    const captchaResult = await rq(options)
    console.log('captchaResult', captchaResult)
    console.log('captcha success', captchaResult.success)
    if (captchaResult['success'] === undefined || !captchaResult['success']) {
        throw captchaResult
    }
    return captchaResult
}

/**
 * Get password hash
 */
const getHash = async (data: string,  saltOrRounds: string | number = saltRounds ) => {
    const hash = await bcrypt.hash(data, saltOrRounds)
    return hash
}

/**
 * Verify password hash
 */
const verifyPasswordHash = async (originalPassword: string, matchPassword: string) => {
   const isSame = await bcrypt.compare(originalPassword, matchPassword)
   return isSame
}

/**
 * Generate PIN Code
 */
const generatePinCode = () => {
   return Math.floor(1000 + Math.random() * 9000)
}

/**
 * Generate counter hash to count based on user request
 */
const generateRequestCounterHash = (email: string, count: number) => {
    return getHash(`${email}-${count}`)
}

export const authAPI = {
    signJWT,
    verifyJWT,
    verifyCaptcha,
    getHash,
    verifyPasswordHash,
    generatePinCode,
    generateRequestCounterHash
}