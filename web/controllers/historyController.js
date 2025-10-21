import CategorizationHistory from "../models/CategorizationHistory.js";
import CategorizationLog from "../models/CategorizationLog.js";

/**
 * 📜 Fetch all categorization histories with pagination, search, and sorting.
 */
export const getAllHistories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      search = "",
      status,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      // Search by shop name, shop URL, or jobId if available
      query.$or = [
        { shop: { $regex: search, $options: "i" } },
        { jobId: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status; // Optional filter by status

    // ⚙️ Fetch data with pagination & sorting
    const histories = await CategorizationHistory.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CategorizationHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Histories fetched successfully",
      meta: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        pageSize: parseInt(limit),
      },
      data: histories,
    });
  } catch (error) {
    console.error("❌ Error fetching histories:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch histories",
      error: error.message,
    });
  }
};

/**
 * 🧾 Fetch logs for a specific history with pagination and metadata.
 */
export const getHistoryLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = "-createdAt" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ Check if history exists
    const historyExists = await CategorizationHistory.exists({ _id: id });
    if (!historyExists) {
      return res.status(404).json({
        success: false,
        message: "Categorization history not found",
      });
    }

    // 📄 Fetch logs with pagination
    const logs = await CategorizationLog.find({ historyId: id })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalLogs = await CategorizationLog.countDocuments({ historyId: id });

    res.status(200).json({
      success: true,
      message: "Logs fetched successfully",
      meta: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLogs / limit),
        totalRecords: totalLogs,
        pageSize: parseInt(limit),
      },
      logs,
    });
  } catch (error) {
    console.error("❌ Error fetching history logs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch history logs",
      error: error.message,
    });
  }
};
