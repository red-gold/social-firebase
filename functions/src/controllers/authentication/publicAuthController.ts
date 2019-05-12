import * as functions from 'firebase-functions'
import { adminDB, firestoreDB } from '../../data/index'
import * as _ from 'lodash'
import * as express from 'express'
import * as bodyParser from 'body-parser'
import { SocialError } from '../../domain/common/index'
import { HttpStatusCode } from '../../data/httpStatusCode'
import { TokenType } from '../../domain/authentication/tokenType'
import { authAPI } from '../../api/authAPI'
import * as Ajv from 'ajv'
import { userRegisterTokenSchema } from '../../schemas/createUserRegisterSchema'
import { authenticationService } from '../../services/authentication/authenticationService'
import { AuthKeywordsEnum } from '../../domain/authentication/authKeywordsEnum'
import { VerifyType } from '../../domain/authentication/verifyType'
import { verifyTokenRegisterUserSchema } from '../../schemas/verifyTokenRegisterUserSchema'
import { RegisterUserModel } from '../../models/authentication/registerUserMode'

const cookieParser = require('cookie-parser')()
const verifyMode = functions.config().verify.mode

/**
 * Login user API
 */
const login = async (req: express.Request, res: express.Response) => {
    const remoteIpAddress = req.connection.remoteAddress
    const userName = req.body['userName']
    const password = req.body['password']
    console.log(userName, password)
    try {

        const userSecret$ = firestoreDB.collection('userSecret').where('userName', '==', userName).get()
        const protectResult = await userSecret$
        console.log('result', protectResult.size, protectResult.empty)
        if (protectResult && !protectResult.empty && protectResult.size === 1) {
            const doc = protectResult.docs[0]
            const data = doc.data()
            console.log('data = ', data)
            const {emailVerified, phoneVerified} = data
            const isSame = await authAPI.verifyPasswordHash(password, data.password)
            if (isSame === true) {
                console.log(`verifyMode: ${parseInt(verifyMode as string, 10)} - ${verifyMode === VerifyType.Email} - (${VerifyType.Email}) - emailVerified: ${emailVerified} - phoneVerified: ${phoneVerified}`)
                const additionalClaims = {
                    isVerified: (parseInt(verifyMode as string, 10) === VerifyType.Email) ? emailVerified : phoneVerified, 
                    userName: data.userName
                }
                try {
                    const token = await authenticationService.createAuthCustomToken(doc.id, additionalClaims)

                    // Send token back to client
                    return res.status(HttpStatusCode.OK).json({ token })

                } catch (error) {
                    console.log('Error creating custom token:', error)
                    return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/CreateToke', 'Error on creating token!'))
                }
            } else {
                return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/WrongPassword', 'Password is wrong!'))
            }

        } else {
            return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/WrongUserName', 'User name is wrong!'))
        }

    } catch (error) {
        return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/FirestoreGetData', error))

    }

}

/**
 * Register user
 */
const createUserRegisterToken = async (req: express.Request, res: express.Response) => {
    const ajv = new Ajv({ allErrors: true })
    var validate = ajv.compile(userRegisterTokenSchema)
    var valid = validate(req.body)
    if (!valid) {
        console.log(validate.errors)
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('ServerError/createUserRegisterToken', JSON.stringify(validate.errors)))
    }

    const gReCaptcha = req.body['g-recaptcha-response']
    const code = authAPI.generatePinCode()

    const remoteIpAddress = req.connection.remoteAddress
    const {user, verifyType} = req.body
    const emailExist = await authenticationService.checkEmailExist(user.email)
    console.log('emailExist: ', emailExist)
    if (emailExist) {
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('createUserRegisterToken/EmailExist', 'Email exist!'))

    }
    user.id = firestoreDB.collection('users').doc().id 

    try {
        await authAPI.verifyCaptcha(gReCaptcha, remoteIpAddress)
        let verificationToken = null
        if (verifyType === VerifyType.Email) {
            verificationToken = await authenticationService.createEmailVerficationToken({user, code,remoteIpAddress, counter: 1, tokenType: TokenType.Registeration, tokenPayload: {user}})
        } else {
            verificationToken = await authenticationService
            .createPhoneVerficationToken({user, code,remoteIpAddress, counter: 1, tokenType: TokenType.Registeration, tokenPayload: {user}})
        }
        return res.status(HttpStatusCode.OK).json({ [
            AuthKeywordsEnum.TokenVerificaitonSecretData]: verificationToken
        })

    } catch (error) {
        console.log('error', error)
        return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/createUserRegisterToken', 'Can not generate token!'))
    }
}

/**
 * Verify phone code
 */
const verifyRegisterUser = async (req: express.Request, res: express.Response) => {
    const ajv = new Ajv({ allErrors: true })
    var validate = ajv.compile(verifyTokenRegisterUserSchema)
    var valid = validate(req.body)
    if (!valid) {
        console.log(validate.errors)
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('verifyRegisterUser/invalidParameters', JSON.stringify(validate.errors)))
    }
    try {

        const remoteIpAddress = req.connection.remoteAddress
        const code = req.body['code']
        const token = req.body[AuthKeywordsEnum.TokenVerificaitonSecretData]
        const decodedToken = await authAPI.verifyJWT(token)
        const { user, remoteIpAddress: userRemoteAddress, verifyId, verifyType } = decodedToken
        if (userRemoteAddress !== remoteIpAddress) {
            console.log('Request is not from the same remote address!')
            return res.status(HttpStatusCode.BadRequest).send(new SocialError('createCodeVerification/notSameRemoteAddress', 'Request is not from same remote address!'))
        }

        const verifyTarget = (verifyType === VerifyType.Email) ? user.email : user.phoneNumber

        await authenticationService
            .verifyUserByCode({userId: user.id, verifyId, remoteIpAddress, code, target: verifyTarget} )

        try {
            const emailVerified = verifyType === VerifyType.Email
            const phoneVerified = verifyType === VerifyType.Phone
            const registerModel = new RegisterUserModel(
                user.id,
                user.fullName,
                '',
                user.email,
                user.password,
                remoteIpAddress,
                phoneVerified,
                emailVerified,
                user.phoneNumber
                )
            const registerUser$ = authenticationService.registerUser(registerModel)
            const saveUserSecret$ = authenticationService.saveUserSecret(registerModel)

            const additionalClaims = {
                isVerified: true, 
                userName: user.email
            }
            const customToken$ = adminDB.auth().createCustomToken(user.id, additionalClaims)
            try {
                const [registerUserResult, userSecretResult, customTokenResult] = await Promise.all([registerUser$, saveUserSecret$, customToken$])
                // Send token back to client
                return res.status(HttpStatusCode.OK).json({ token: customTokenResult })

            } catch (error) {
                throw new SocialError('ServerError/CreateCustomToken', 'Create custom token error!', HttpStatusCode.InternalServerError)

            }

        } catch (error) {
            throw new SocialError('ServerError/VerifyIdNotAccept', "We coudn't for you verification!")
        }

    } catch (error) {
        console.log('error', error)
        if (error.isError) {
            res.status(HttpStatusCode.Forbidden).send(error)            
        } else {
            res.status(HttpStatusCode.InternalServerError).send(error)
        }

    }
}

/**
 * Create code verification
 */
const createCodeVerification = async (req: express.Request, res: express.Response) => {
    try {

        const remoteIpAddress = req.connection.remoteAddress
        const gReCaptcha = req.body['g-recaptcha-response']
        const code = Math.floor(1000 + Math.random() * 9000)
        const token = req.body[AuthKeywordsEnum.TokenSecretData]
        const decodedToken = await authAPI.verifyJWT(token)
        const { user, verifyType, remoteIpAddress: userRemoteAddress } = decodedToken
        if (userRemoteAddress !== remoteIpAddress) {
            console.log('Request is not from same remote address!')
            return res.status(HttpStatusCode.BadRequest).send(new SocialError('createCodeVerification/notSameRemoteAddress', 'Request is not from same remote address!'))

        }

        await authAPI.verifyCaptcha(gReCaptcha, remoteIpAddress)
        let verificationToken = null

        if (verifyType === VerifyType.Email) {
            verificationToken = await authenticationService
            .createEmailVerficationToken({user, code,remoteIpAddress, counter: 1, tokenType: TokenType.Registeration, tokenPayload: {user}})
        } else {
            verificationToken = await authenticationService
            .createPhoneVerficationToken({user, code,remoteIpAddress, counter: 1, tokenType: TokenType.Registeration, tokenPayload: {user}})
        }
        return res.status(HttpStatusCode.OK).json({ [AuthKeywordsEnum.TokenVerificaitonSecretData]: verificationToken })

    } catch (error) {
        console.log(error)
        res.status(HttpStatusCode.NotFound).send(new SocialError('createCodeVerification', 'Internal server error!'))

    }

}

/**
 * Verify reset password code
 */
const verifyResetPasswordCode = async (req: express.Request, res: express.Response) => {
    const remoteIpAddress = req.connection.remoteAddress
    const code = req.body['code'] as string
    const token = req.body[AuthKeywordsEnum.TokenVerificaitonSecretData]
    const decodedToken = await authAPI.verifyJWT(token)
    const { user, verifyType, verifyId, mode, remoteIpAddress: userRemoteAddress } = decodedToken
    if (mode !== TokenType.ResetPassword) {
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('ServerError/DifferentMode', 'Token is in different mode!'))    
    }
    if (userRemoteAddress !== remoteIpAddress) {
        console.log('Request is not from same remote address!')
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('createCodeVerification/notSameRemoteAddress', 'Request is not from same remote address!'))

    }

    try {

    const verifyTarget = (verifyType === VerifyType.Email) ? user.email : user.phoneNumber
    const verifyResult = await authenticationService.verifyUserByCode({userId: user.id, verifyId, remoteIpAddress, code, target: verifyTarget} )
    const payload = {
            user,
            verifyType,
            remoteIpAddress,
            mode: TokenType.ResetPassword
    }
        const token = await authAPI.signJWT(payload, '1h')
        return res.status(HttpStatusCode.OK).json({ [AuthKeywordsEnum.TokenSecretData]: token })
    } catch (error) {
        console.log(error)
        return res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/verifyResetPasswordCode', 'Token scope!'))
    }
}

/**
 * Update password
 */
const updatePassword = async (req: express.Request, res: express.Response) => {
    const remoteIpAddress = req.connection.remoteAddress
    const newPassword = req.body['newPassword'] as string
    const confirmPassword = req.body['confirmPassword'] as string
    const token = req.body[AuthKeywordsEnum.TokenSecretData]
    const decodedToken = await authAPI.verifyJWT(token)
    const { user, mode, remoteIpAddress: userRemoteAddress } = decodedToken
    if (mode !== TokenType.ResetPassword) {
        return res.status(HttpStatusCode.BadRequest).send(new SocialError('ServerError/DifferentMode', 'Token is in different mode!'))    
    }
    if (userRemoteAddress !== remoteIpAddress) {
            console.log('Request is not from same remote address!')
            return res.status(HttpStatusCode.BadRequest).send(new SocialError('createCodeVerification/notSameRemoteAddress', 'Request is not from same remote address!'))

    }
    const userId = user.id as string
    console.log('userID: ', userId)
    if ((newPassword && confirmPassword)
        && (newPassword.trim() !== '' && confirmPassword.trim() !== '')
        && (confirmPassword === newPassword)) {

        try {
            await authenticationService.updatePassword(userId, newPassword)
            return res.status(HttpStatusCode.OK).json({})            
        } catch (error) {
            console.log('UpdateUser/Password', error)
            res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/ErrorUpdateUser', 'Can not update user!'))
        }

    } else {
        res.status(HttpStatusCode.InternalServerError).send(new SocialError('ServerError/NotEqualConfirmNewPassword', 'Confirm password and new password are not equal!'))
    }

}

/**
 * Create reset password code verification
 */
const resetPasswordCodeVerification = async (req: express.Request, res: express.Response) => {
    try {

        const remoteIpAddress = req.connection.remoteAddress
        const gReCaptcha = req.body['g-recaptcha-response']
        const code = Math.floor(1000 + Math.random() * 9000)
        let { user, verifyType } = req.body

        await authAPI.verifyCaptcha(gReCaptcha, remoteIpAddress)
        let verificationToken = null
        if (verifyType === VerifyType.Email) {

            // Check if email exist then create verification code
            const existUserInfo = await authenticationService.checkEmailExist(user.email)
            console.log('emailExist: ', existUserInfo)
            if (!existUserInfo) {
                return res.status(HttpStatusCode.BadRequest).send(new SocialError('resetPasswordCodeVerification/EmailNoExist', 'Email does not exist!'))
            }
            user = {...user, id: existUserInfo.id, fullName: existUserInfo.fullName }
            verificationToken = await authenticationService
            .createEmailVerficationToken(
                {user, code,remoteIpAddress, counter: 1, tokenType: TokenType.ResetPassword, tokenPayload: {user: {email: user.email, id: existUserInfo.id}}})
        } else {

            // Check if phone number exist then create verification code
            const existUserInfo = await authenticationService.checkPhoneNumberExist(user.phone)
            console.log('phoneExist: ', existUserInfo)
            if (!existUserInfo) {
                return res.status(HttpStatusCode.BadRequest).send(new SocialError('resetPasswordCodeVerification/PhoneNoExist', 'Phone does not exist!'))
            }
            user = {...user, id: existUserInfo.id, fullName: existUserInfo.fullName }
            verificationToken = await authenticationService
            .createPhoneVerficationToken({user, 
                code,remoteIpAddress, 
                counter: 1,
                tokenType: TokenType.ResetPassword, 
                tokenPayload: {user: {phone: user.phone, id: existUserInfo.id}}})
        }
        return res.status(HttpStatusCode.OK).json({ [AuthKeywordsEnum.TokenVerificaitonSecretData]: verificationToken })

    } catch (error) {
        console.log(error)
        res.status(HttpStatusCode.NotFound).send(new SocialError('resetPasswordCodeVerification', 'Internal server error!'))

    }

}

/**
 * Intialize express server to handle http(s) requests
 */
const app = express()
const cors = require('cors')({ origin: true })
app.disable('x-powered-by')
app.use(cors)
app.use(bodyParser.json())
app.use(cookieParser)

/**
 * Routes
 */
app.post('/api/user-register-token', createUserRegisterToken)
app.post('/api/create-verification-code', createCodeVerification)
app.post('/api/reset-password-code', resetPasswordCodeVerification)
app.post('/api/verify-register-user', verifyRegisterUser)
app.post('/api/verify-reset-password-code', verifyResetPasswordCode)
app.post('/api/update-password', updatePassword)
app.post('/api/login', login)

/**
 * Public authentication
 */
export const publicAuth = functions.https.onRequest(app)