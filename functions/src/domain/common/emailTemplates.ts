const verification = (fullName: string, code: number, appName: string) => {
    return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN" "http://www.w3.org/TR/REC-html40/loose.dtd">
    <html>
        
      </head>
      <body>
        <div class="card">
          <p> Hello ${fullName}</p>
          <p class="title" style="color:grey;font-size:18px;">${code}  </p> is your verification code for ${appName}
          <p></p>
          <div style="margin: 24px 0;">
          </div>
        </div>
      </body>
    </html>
    `
}

const codeVerification = (fullName: string, code: number, appName: string, targetEmail: string) => {
  return `
  <html xmlns="http://www.w3.org/1999/xhtml">

  <body>
  <div>
      <h4>Hello ${fullName},</h4>

      <p>Verification code from ${appName} for ${targetEmail}.</p>

      <h3>Code Verification: ${code}</h3>

      <p>If you did not request to reset your password, you can ignore this email.</p>

      <h4>Thanks,</h4>

      <h4>${appName} Team</h4>
  </div>
  </body>
  </html> 
  `
}

export const emailTemplates = {
  verification,
  codeVerification
}