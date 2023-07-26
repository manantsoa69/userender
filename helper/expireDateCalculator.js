  //helper/expireDateCalculator.js
const calculateExpirationDate = (subscriptionDetails, subscriptionStatus) => {

  if (subscriptionStatus === 'E') {
    return null; // Return null for expired subscriptions
  }

  const currentDate = new Date(); // Use built-in Date object for date handling

  const expirationMap = {
    '1D': currentDate => currentDate.setDate(currentDate.getDate() + 1),
    '1M': currentDate => currentDate.setMonth(currentDate.getMonth() + 1),
    '3M': currentDate => currentDate.setMonth(currentDate.getMonth() + 3),
    '6M': currentDate => currentDate.setMonth(currentDate.getMonth() + 6),
    '1Y': currentDate => currentDate.setFullYear(currentDate.getFullYear() + 1),
    '10M': currentDate => currentDate.setMinutes(currentDate.getMinutes() + 5),
  };

  const expirationHandler = expirationMap[subscriptionDetails];
  if (expirationHandler) {
    expirationHandler(currentDate);
    return currentDate;
  }

  return null; // Return null for unknown or invalid subscriptionDetails
}


module.exports = {
  calculateExpirationDate
};
