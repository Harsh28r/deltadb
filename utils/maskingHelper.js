/**
 * Utility functions for masking sensitive contact information
 * @module maskingHelper
 */

/**
 * Mask phone number - shows first 2 and last 2 digits, rest are masked
 * Examples:
 *  9876543210 => 98******10
 *  +91-9876543210 => +91-98******10
 *  (123) 456-7890 => (12*) ***-**90
 *
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone number
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;

  // Extract only digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) {
    // Too short to mask meaningfully
    return phone.replace(/./g, '*');
  }

  // Keep first 2 and last 2 digits visible
  const firstTwo = digits.substring(0, 2);
  const lastTwo = digits.substring(digits.length - 2);
  const middleLength = digits.length - 4;
  const masked = `${firstTwo}${'*'.repeat(middleLength)}${lastTwo}`;

  // Try to preserve original formatting pattern
  const nonDigits = phone.replace(/\d/g, '');
  if (nonDigits.length > 0) {
    // Has special characters - preserve some formatting
    return phone.replace(/\d/g, (digit, index) => {
      const digitIndex = phone.substring(0, index).replace(/\D/g, '').length;
      if (digitIndex < 2 || digitIndex >= digits.length - 2) {
        return digit; // Keep first 2 and last 2
      }
      return '*';
    });
  }

  return masked;
};

/**
 * Mask email address - shows first 2 characters and domain, rest are masked
 * Examples:
 *  john.doe@example.com => jo******@example.com
 *  test@gmail.com => te**@gmail.com
 *
 * @param {string} email - Email address to mask
 * @returns {string} Masked email address
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email;

  const [localPart, domain] = email.split('@');

  if (localPart.length <= 2) {
    return `${localPart.charAt(0)}*@${domain}`;
  }

  const firstTwo = localPart.substring(0, 2);
  const maskedLength = Math.max(2, localPart.length - 2);
  const masked = `${firstTwo}${'*'.repeat(maskedLength)}@${domain}`;

  return masked;
};

/**
 * Mask custom data fields that contain contact information
 * This recursively masks phone/email fields in nested objects
 *
 * @param {Object} customData - Lead custom data object
 * @param {Array<string>} sensitiveFields - Field names to mask (default: ['phone', 'contact', 'mobile', 'email', 'whatsapp'])
 * @returns {Object} Masked custom data
 */
const maskCustomData = (customData, sensitiveFields = ['phone', 'contact', 'mobile', 'email', 'whatsapp', 'phoneNumber', 'contactNumber']) => {
  if (!customData || typeof customData !== 'object') return customData;

  const masked = { ...customData };

  for (const key in masked) {
    if (masked.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();

      // Check if this field should be masked
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        const value = masked[key];

        if (typeof value === 'string') {
          // Determine if it's email or phone
          if (value.includes('@')) {
            masked[key] = maskEmail(value);
          } else {
            masked[key] = maskPhoneNumber(value);
          }
        }
      } else if (typeof masked[key] === 'object' && masked[key] !== null && !Array.isArray(masked[key])) {
        // Recursively mask nested objects
        masked[key] = maskCustomData(masked[key], sensitiveFields);
      }
    }
  }

  return masked;
};

/**
 * Mask lead object based on user permissions
 * This masks phone, email, and other sensitive contact fields in customData
 *
 * @param {Object} lead - Lead document (plain object or Mongoose document)
 * @param {boolean} hasPermission - Whether user has permission to view full contact
 * @returns {Object} Lead object with masked data (if no permission)
 */
const maskLeadContact = (lead, hasPermission) => {
  if (hasPermission) {
    return lead; // Return as-is if user has permission
  }

  // Create a copy to avoid mutating original
  const maskedLead = JSON.parse(JSON.stringify(lead));

  // Mask customData fields
  if (maskedLead.customData) {
    maskedLead.customData = maskCustomData(maskedLead.customData);
  }

  // Also mask populated channelPartner phone if present
  if (maskedLead.channelPartner && typeof maskedLead.channelPartner === 'object') {
    if (maskedLead.channelPartner.phone) {
      maskedLead.channelPartner.phone = maskPhoneNumber(maskedLead.channelPartner.phone);
    }
  }

  // Mask cpSourcingId user phone if populated
  if (maskedLead.cpSourcingId &&
      typeof maskedLead.cpSourcingId === 'object' &&
      maskedLead.cpSourcingId.userId &&
      typeof maskedLead.cpSourcingId.userId === 'object') {
    if (maskedLead.cpSourcingId.userId.phone) {
      maskedLead.cpSourcingId.userId.phone = maskPhoneNumber(maskedLead.cpSourcingId.userId.phone);
    }
  }

  return maskedLead;
};

/**
 * Mask an array of leads based on user permissions
 *
 * @param {Array<Object>} leads - Array of lead documents
 * @param {boolean} hasPermission - Whether user has permission to view full contact
 * @returns {Array<Object>} Array of leads with masked data (if no permission)
 */
const maskLeads = (leads, hasPermission) => {
  if (!Array.isArray(leads)) return leads;
  if (hasPermission) return leads;

  return leads.map(lead => maskLeadContact(lead, hasPermission));
};

module.exports = {
  maskPhoneNumber,
  maskEmail,
  maskCustomData,
  maskLeadContact,
  maskLeads
};
