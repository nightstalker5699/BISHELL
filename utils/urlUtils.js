/**
 * Generate a secure URL for an attachment file
 * @param {Object} req - Express request object
 * @param {string} filename - Attachment filename
 * @returns {string} Secure HTTPS URL
 */
exports.getSecureAttachmentUrl = (req, filename) => {
    // Get host from request, but always use HTTPS protocol
    const host = req.get('host');
    return `https://${host}/attachFile/${filename}`;
  };