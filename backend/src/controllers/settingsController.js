import { storage } from '../services/storage.js';
import { logger } from '../utils/logger.js';

export const getSettings = async (req, res) => {
  try {
    const settings = await storage.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    logger.error(`Error in getSettings: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const newSettings = req.body;
    const updated = await storage.updateSettings(newSettings);
    res.json({
      success: true,
      message: 'Business settings updated successfully.',
      data: updated
    });
  } catch (err) {
    logger.error(`Error in updateSettings: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

