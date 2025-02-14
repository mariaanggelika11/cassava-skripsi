import User from "../models/UserModel.js";
import bcrypt from "bcrypt";
import PetaniUsers from "../models/PetaniUserModel.js";
import LogisticUser from "../models/LogisticUserModel.js";
import PabrikUser from "../models/PabrikUserModel.js";
import PerusahaanUser from "../models/PerusahaanUserModel.js";
import fs from "fs/promises";
import path from "path";
import jwt from "jsonwebtoken";

const uploadDir = path.join(process.cwd(), "uploads", "img", "profile");

async function deleteFile(filename) {
  const filePath = path.join(uploadDir, filename);
  try {
    console.log(`Memeriksa dan menghapus file: ${filePath}`);
    await fs.unlink(filePath);
    console.log(`File berhasil dihapus: ${filePath}`);
  } catch (error) {
    console.error(`Gagal menghapus file ${filename}: ${error.message}`);
  }
}

export const createUser = async (req, res) => {
  const { name, email, password, confPassword, role, nohp, alamat } = req.body;
  const foto = req.file ? req.file.filename : "";

  if (password !== confPassword) {
    return res.status(400).json({ msg: "Password dan Confirm Password tidak cocok" });
  }

  try {
    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashPassword,
      role,
    });

    const userDetails = {
      uuid: newUser.uuid,
      name,
      email,
      nohp: nohp || "",
      alamat: alamat || "",
      foto: foto,
      url: `${req.protocol}://${req.get("host")}/profile/profile.png`,
      password: hashPassword,
    };

    if (role.toLowerCase() === "petani") {
      await PetaniUsers.create(userDetails);
    } else if (role.toLowerCase() === "logistik") {
      await LogisticUser.create(userDetails);
    } else if (role.toLowerCase() === "pabrik") {
      await PabrikUser.create(userDetails);
    } else if (role.toLowerCase() === "perusahaan") {
      await PerusahaanUser.create(userDetails);
    }

    res.status(201).json({ msg: "Register Berhasil" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ msg: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { uuid } = req.params;
  const { name, email, password, confPassword, role, nohp, alamat } = req.body;

  if (password !== confPassword) {
    return res.status(400).json({ msg: "Password dan Confirm Password tidak cocok" });
  }

  try {
    const userToUpdate = await User.findOne({ where: { uuid } });
    if (!userToUpdate) {
      return res.status(404).json({ msg: "User tidak ditemukan" });
    }

    let hashPassword = userToUpdate.password;
    if (password && password.trim() !== "") {
      hashPassword = await bcrypt.hash(password, 10);
    }

    let foto = userToUpdate.foto;
    let url = userToUpdate.url;

    if (req.file) {
      foto = req.file.filename;
      url = `${req.protocol}://${req.get("host")}/profile/${req.file.filename}`;

      if (userToUpdate.foto && !userToUpdate.foto.startsWith("defaultProfile.png")) {
        await deleteFile(userToUpdate.foto);
      }
    }

    await User.update(
      {
        name,
        email,
        password: hashPassword,
        role,
        foto,
        url,
      },
      { where: { uuid } }
    );

    const updateDetails = { name, email, nohp: nohp || "", alamat: alamat || "", foto, url, password: hashPassword };

    switch (role.toLowerCase()) {
      case "petani":
        await PetaniUsers.update(updateDetails, { where: { uuid } });
        break;
      case "logistik":
        await LogisticUser.update(updateDetails, { where: { uuid } });
        break;
      case "pabrik":
        await PabrikUser.update(updateDetails, { where: { uuid } });
        break;
      case "perusahaan":
        await PerusahaanUser.update(updateDetails, { where: { uuid } });
        break;
      default:
        console.log("Role pengguna tidak dikenali, update detail pengguna tidak dilakukan.");
        break;
    }

    res.status(200).json({ msg: "User berhasil diperbarui" });
  } catch (error) {
    console.error("Error saat memperbarui user:", error.message);
    res.status(500).json({ msg: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ where: { uuid: req.params.uuid } });

    if (!user) {
      return res.status(404).json({ msg: "User tidak ditemukan" });
    }

    let fotoFilename;

    switch (user.role.toLowerCase()) {
      case "petani":
        const petani = await PetaniUsers.findOne({ where: { uuid: user.uuid } });
        fotoFilename = petani?.foto;
        await PetaniUsers.destroy({ where: { uuid: user.uuid } });
        break;
      case "logistik":
        const logistik = await LogisticUser.findOne({ where: { uuid: user.uuid } });
        fotoFilename = logistik?.foto;
        await LogisticUser.destroy({ where: { uuid: user.uuid } });
        break;
      case "pabrik":
        const pabrik = await PabrikUser.findOne({ where: { uuid: user.uuid } });
        fotoFilename = pabrik?.foto;
        await PabrikUser.destroy({ where: { uuid: user.uuid } });
        break;
      case "perusahaan":
        const perusahaan = await PerusahaanUser.findOne({ where: { uuid: user.uuid } });
        fotoFilename = perusahaan?.foto;
        await PerusahaanUser.destroy({ where: { uuid: user.uuid } });
        break;
      default:
        console.log("Role pengguna tidak dikenali, tidak ada foto untuk dihapus.");
    }

    if (fotoFilename) {
      await deleteFile(fotoFilename);
    }

    await User.destroy({ where: { uuid: user.uuid } });

    res.status(200).json({ msg: "User berhasil dihapus" });
  } catch (error) {
    console.error("Error saat menghapus user:", error.message);
    res.status(500).json({ msg: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const response = await User.findAll({
      attributes: ["uuid", "name", "email", "role"],
    });
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { uuid: req.params.uuid },
      attributes: ["uuid", "name", "email", "role"],
    });

    if (!user) return res.status(404).json({ msg: "User tidak ditemukan" });

    let userDetails = {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
      additionalInfo: {},
    };

    switch (user.role.toLowerCase()) {
      case "petani":
        userDetails.additionalInfo = await PetaniUsers.findOne({ where: { uuid: user.uuid } });
        break;
      case "logistik":
        userDetails.additionalInfo = await LogisticUser.findOne({ where: { uuid: user.uuid } });
        break;
      case "pabrik":
        userDetails.additionalInfo = await PabrikUser.findOne({ where: { uuid: user.uuid } });
        break;
      case "perusahaan":
        userDetails.additionalInfo = await PerusahaanUser.findOne({ where: { uuid: user.uuid } });
        break;
    }

    res.status(200).json(userDetails);
  } catch (error) {
    console.error("Error saat mendapatkan detail pengguna:", error.message);
    res.status(500).json({ msg: error.message });
  }
};
