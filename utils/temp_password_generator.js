function generateTempPassword(businessName) {
  // Take first 4 letters of business name, capitalize first letter
  const prefix = businessName.substring(0, 4).charAt(0).toUpperCase() + 
                 businessName.substring(1, 4).toLowerCase();
  
  // Generate 7 random digits
  const digits = Math.floor(1000000 + Math.random() * 9000000);
  
  // Add special character
  return `${prefix}${digits}!`;
}

module.exports = { generateTempPassword };
