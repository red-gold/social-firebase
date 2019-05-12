export class VerifyByCodeModel {
    constructor(
        public userId: string, 
        public verifyId: string, 
        public remoteIpAddress: string, 
        public code: string, 
        public target: string
    ) {
        
    }
}