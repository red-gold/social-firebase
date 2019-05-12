export class CodeByEmailModel {
    constructor(
       public email: string, 
       public subject: string, 
       public from: string, 
       public html: string
    ) {
        
    }
}