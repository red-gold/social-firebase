import * as functions from 'firebase-functions'
const plivo = require('plivo')

/**
 * Send SMS
 */
const send = async (sourceNumber: string, targetNumber: string, text: string) => {
    const client = new plivo.Client(functions.config().plivo.authid, functions.config().plivo.authtoken)
    const smsResult = await client.messages.create(sourceNumber, targetNumber, text)
    return smsResult
}

export const smsController = {
    send
}