import { ProductCategory } from "../models/Category.js";

export const getCategory = async (req, res) => {
  try {
    const categories = await ProductCategory.aggregate([
      {
        $group: {
          _id: "$top_level_category_level_1",
        },
      },
    ]);
    const newArray = categories.map((item) => item._id);
    // const cat = await ProductCategory.aggregate([
    //   {
    //     $match: { top_level_category_level_1: "Books" },
    //   },
    //   {
    //     $group: {
    //       _id: "$sub_category_level_2",
    //       count: { $sum: 1 },
    //     },
    //   },
    // ]);
    console.log(categories.length);
    res.status(200).json(categories);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

