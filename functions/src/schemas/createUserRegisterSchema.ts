import { VerifyType } from '../domain/authentication/verifyType'

export const userRegisterTokenSchema = {
    'additionalProperties': false,
    'required': ['user', 'verifyType'],
    'type': 'object',    
    'properties': {
        'user': {
            'additionalProperties': false,
            'required': ['fullName', 'email', 'password'],
            'type': 'object',
            'properties': {
                'fullName': { 'type': 'string' },
                'email': { 'type': 'string'},
                'password': { 'type': 'string' }
            }
        },
        'verifyType': {
            'enum': [VerifyType.Email, VerifyType.Phone]
        },
        'g-recaptcha-response': {
            'type': 'string'
        }
        
      }
}