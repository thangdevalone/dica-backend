import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import {
  ChangeUsernameDto,
  UpdateProfileDto,
} from "../src/auth/dto/profile.dto.js";

test("các trường hồ sơ nhân viên đều không bắt buộc và có thể xóa bằng chuỗi rỗng", async () => {
  const dto = Object.assign(new UpdateProfileDto(), {
    display_name: "",
    identity_number: "",
    date_of_birth: "",
    phone: "",
    email: "",
    address: "",
  });

  assert.deepEqual(await validate(dto), []);
});

test("từ chối CCCD, ngày sinh và email sai định dạng", async () => {
  const dto = Object.assign(new UpdateProfileDto(), {
    identity_number: "123ABC",
    date_of_birth: "05/10/2000",
    email: "khong-phai-email",
  });

  const properties = (await validate(dto))
    .map((error) => error.property)
    .sort();
  assert.deepEqual(properties, ["date_of_birth", "email", "identity_number"]);
});

test("tên đăng nhập mới chỉ nhận ký tự an toàn", async () => {
  const dto = Object.assign(new ChangeUsernameDto(), {
    username: "nhân viên",
    current_password: "mat-khau-hien-tai",
  });

  assert.ok(
    (await validate(dto)).some((error) => error.property === "username"),
  );
});
