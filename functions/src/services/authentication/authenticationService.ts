import { adminDB, firestoreDB } from '../../data/index'
import * as functions from 'firebase-functions'
import { emailAPI } from '../../api/emailAPI'
import { VerifyType } from '../../domain/authentication/verifyType'
import { Verification } from '../../domain/authentication/Verification'
import * as moment from 'moment/moment'
import { Email } from '../../domain/common/email'
import { SocialError } from '../../domain/common'
import { commonAPI } from '../../api/commonAPI'
import { authAPI } from '../../api/authAPI'
import { UserPermissionType } from '../../domain/common/userPermissionType'
import { TokenType } from '../../domain/authentication/tokenType'
import { emailTemplates } from '../../domain/common/emailTemplates'
import { phoneTemplates } from '../../domain/common/phoneTemplates'
import { phoneAPI } from '../../api/phoneAPI'
import { RegisterUserModel } from '../../models/authentication/registerUserMode'
import { VerificationSavedModel } from '../../models/authentication/verificationSavedModel'
import { EmailVerificationTokenModel } from '../../models/authentication/emailVerificationTokenModel'
import { VerifyByCodeModel } from '../../models/authentication/verifyByCodeModel'
import { PhoneVerficationTokeModel } from '../../models/authentication/phoneVerficationTokeModel'
import { CodeByEmailModel } from '../../models/authentication/codeByEmailModel'
import { HttpStatusCode } from '../../data/httpStatusCode'
const gmailEmail = functions.config().gmail.email
const appName = functions.config().setting.appname
const numberOfRequestVerifyCode = 3

/**
 * Create verification code
 */
const createVerificationCode = () => {

}

/**
 * Update user password
 */
const updatePassword = async (userId: string, newPassword: string) => {
    const hash = await authAPI.getHash(newPassword)
    // Store hash in your password DB.
    try {
        await firestoreDB.collection('userSecret').doc(userId)
            .update({
                password: hash
            })

    } catch (error) {
        console.log('authService/updatePassword', error)
        throw new SocialError('authService/updatePassword', 'Can not store protected user!')
    }
}

/**
 * Verify user by code
 */
const verifyUserByCode = async (model: VerifyByCodeModel) => {
    const verifyRef = firestoreDB.collection('users')
    .doc(model.userId).collection('verification')
    .doc(model.verifyId)

    const verifyDoc$ = verifyRef.get()
    const verifyDoc = await verifyDoc$
    if (!verifyDoc.exists) {
        throw new SocialError('verifyUserByCode/invalidVerifyId', 'Can not find verify id!')
    }
    const verifyData = verifyDoc.data() as Verification
    if (verifyData.remoteIpAddress !== model.remoteIpAddress) {
        throw new SocialError('verifyUserByCode/differentRemoteAddress', 'User with different remote address!')   
    }

    // Log //
    console.log('Verify Code : ', verifyData, 'userId : ', 
    model.userId, 'verifyId : ', model.verifyId, 'code: ', 
    model.code, 'target: ', model.target)
    const verifyCounter = verifyData.counter + 1
    if (verifyCounter > numberOfRequestVerifyCode) {
        throw new SocialError('verifyUserByCode/exceedRequestsLimits', 'The number of requests exceed limitation!')                   
    }

    if (verifyData.isVerified) {
        throw new SocialError('verifyUserByCode/alreadyVerified', 'Current verification verified already!')           
    }

    if (verifyData.target !== model.target) {
        throw new SocialError('verifyUserByCode/differentTarget', 'Not the same target!')           
    }
    if (verifyData.code !== model.code) {
        await verifyRef.update({modifyDate: moment.utc().valueOf(), counter: verifyCounter})
        throw new SocialError('createCodeVerification/wrongPinCode', 'The pin code is wrong!', HttpStatusCode.Unauthorized)       
    }
    if (commonAPI.checkMomentExpire(verifyData.creationDate, 30)) {
        throw new SocialError('verifyUserByCode/codeExpired', 'The code is expired!')
    }

    await verifyRef.update({modifyDate: moment.utc().valueOf(), isVerified: true})

}

/**
 * Create authentication custom token
 */
const createAuthCustomToken = async (userId: string, developerClaims?: Object) => {
    const token = await adminDB.auth().createCustomToken(userId,developerClaims )
    return token
}

/**
 * Register user
 */
const registerUser = async (registerModel: RegisterUserModel) => {
    const saveUserInfo$ = firestoreDB.doc(`userInfo/${registerModel.userId}`).set(
        {
            id: registerModel.userId,
            userId: registerModel.userId,
            state: 'active',
            avatar: registerModel.avatar,
            fullName: registerModel.fullName,
            creationDate: moment.utc().valueOf(),
            email: registerModel.email,
            accessUserList: [],
            permission: UserPermissionType.Public
        }
    )

    await saveUserInfo$
}

/**
 * Save user secret
 */
const saveUserSecret = async (registerModel: RegisterUserModel) => {
    const passwordHash = await authAPI.getHash(registerModel.password)
    const saveUserProtectedInfo$ =  firestoreDB.collection('userSecret').doc(registerModel.userId)
    .set({
        userName: registerModel.email,
        password: passwordHash,
        phoneVerified: (registerModel.phoneVerifide === true),
        emailVerified: (registerModel.emailVerifide === true)
    })
    await saveUserProtectedInfo$
}

/**
 * Create email verification token
 */
const createEmailVerficationToken = async (model: EmailVerificationTokenModel) => {
    console.log('Function', 'create email verification token')

    const html = emailTemplates
    .codeVerification(model.user.fullName, 
        model.code, 
        appName, 
        model.user.email)

    const sendEmail$ = sendVerificationCodeByEmail(
        {
            email: model.user.email, 
            subject: 'Verfication Code', 
            from: 'Verification code for', 
            html
        })

    const saveVerification$ = saveVerificationCode(
        new VerificationSavedModel(model.user.id, 
            model.code, 
            model.user.email, 
            model.counter,
            VerifyType.Email, 
            model.remoteIpAddress))

    const [emailResult, saveResult] = await Promise.all([sendEmail$, saveVerification$])
    const payload = {
        ...model.tokenPayload,
        verifyId: saveResult.id,
        remoteIpAddress: model.remoteIpAddress,
        mode: model.tokenType,
        verifyType: VerifyType.Email
    }

    console.log(payload)
    const verificationToken = await authAPI.signJWT(payload, '1h')

    return verificationToken
}

/**
 * Create phone verification token
 */
const createPhoneVerficationToken = async (model: PhoneVerficationTokeModel) => {
    const message = phoneTemplates.codeVerification(model.code, appName)
    const sendMessage$ = sendVerificationCodeByPhone(model.user.phoneNumer, message)
    const saveVerification$ = saveVerificationCode(
        new VerificationSavedModel(
            model.user.id, 
            model.code, 
            model.user.phoneNumer, 
            model.counter, VerifyType.
            Phone, 
            model.remoteIpAddress))
    const [messageResult, saveResult] = await Promise.all([sendMessage$, saveVerification$])
    const payload = {
        ...model.tokenPayload,
        verifyId: saveResult.id,
        remoteIpAddress: model.remoteIpAddress,
        mode: TokenType.Registeration,
        verifyType: VerifyType.Phone
    }

    console.log(payload)
    const verificationToken = await authAPI.signJWT(payload, '1h')

    return verificationToken
}

/**
 * Save verification code
 */
const saveVerificationCode = async (model: VerificationSavedModel) => {
    const verifyRef = firestoreDB.collection('users')
        .doc(model.userId).collection('verification')
        .doc()
    const verification = new Verification(
        verifyRef.id,
        String(model.code),
        model.target,
        model.targetType,
        model.counter,
        moment.utc().valueOf(),
        model.remoteIpAddress,
        model.userId
    )
    await verifyRef.set({ ...verification })
    return verification
}

/**
 * Send verification code by email
 */
const sendVerificationCodeByEmail = async (model: CodeByEmailModel) => {
    const from = `${appName} ${model.from} <${gmailEmail}>`
    const to = model.email
    const subject = `${model.subject} ${appName}`
    const messageCreated = await emailAPI.sendEmail(new Email(
        from,
        to,
        subject,
        model.html
    ))
    return messageCreated
}

/**
 * Send verification code by phone
 */
const sendVerificationCodeByPhone = async (phoneNumber: string, message: string) => {
    const sourcePhoneNumber = '+9891132357'
    const messageCreated = await phoneAPI.sendMessage(sourcePhoneNumber, phoneNumber, message)
    return messageCreated
}

/**
 * Whether user email exist if yes return true else return false
 */
const checkEmailExist = async (email: string) => {
    const userInfoList = await firestoreDB.collection('userInfo').where('email', '==', email).get()
    return (userInfoList.size > 0) ? userInfoList.docs[0].data() : null
}

/**
 * Whether user phone number exist if yes return true else return false
 */
const checkPhoneNumberExist = async (phoneNumber: string) => {
    const userInfoList = await firestoreDB.collection('userInfo').where('phone', '==', phoneNumber).get()
    return (userInfoList.size > 0) ? userInfoList.docs[0].data() : null
}

export const authenticationService = {
    createVerificationCode,
    checkEmailExist,
    saveVerificationCode,
    verifyUserByCode,
    createAuthCustomToken,
    registerUser,
    saveUserSecret,
    updatePassword,
    createEmailVerficationToken,
    createPhoneVerficationToken,
    sendVerificationCodeByEmail,
    sendVerificationCodeByPhone,
    checkPhoneNumberExist
}