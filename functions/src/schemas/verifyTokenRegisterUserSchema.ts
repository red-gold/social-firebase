import { AuthKeywordsEnum } from '../domain/authentication/authKeywordsEnum'

export const verifyTokenRegisterUserSchema = {
    'additionalProperties': false,
    'required': [AuthKeywordsEnum.TokenVerificaitonSecretData, 'code' ],
    'type': 'object',    
    'properties': {
        'code': {
            'type': 'string'
        },
        [AuthKeywordsEnum.TokenVerificaitonSecretData]: {
            'type': 'string'
        }
        
      }
}