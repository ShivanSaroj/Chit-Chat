const JWT= require('jsonwebtoken')
const secret= "Vibha@123";


function createTokenForUser(user){
    const payload= {
        _id: user._id,
        email: user.email,
        profileImageURL:  user.profileImageURL,
        role: user.role,

    };


    const token= JWT.sign( payload, secret);
    return token;
}


function ValidateToken(token){

    const  payload= JWT.verify(token, secret);
   // console.log('in jwt ', payload)
    return payload;

}

module.exports={
    createTokenForUser,
    ValidateToken,
};