import { beforeEach, describe, expect, it } from "vitest";
import { adminStats, createClass, createSession, getMe, getSessionAttendance, listResults, login, logout, myStudents, saveAttendance, startAttempt, studentStats, submitAttempt, teacherStats } from "@/services/api";
import { resetDemo } from "@/services/mock-db";

describe("demo role flows", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetDemo();
  });

  it("signs in the three seeded roles and returns their role-specific data", async () => {
    const admin = await login("admin", "Admin@1405");
    expect(admin.role).toBe("admin");
    await expect(adminStats()).resolves.toMatchObject({ students: 5, teachers: 2 });

    logout();
    const teacher = await login("teacher", "Teacher@1405");
    expect(teacher.role).toBe("teacher");
    await expect(myStudents()).resolves.toHaveLength(3);
    await expect(adminStats()).rejects.toThrow("اجازه انجام این عملیات را ندارید");

    logout();
    const student = await login("student", "Student@1405");
    expect(student.role).toBe("student");
    await expect(studentStats()).resolves.toHaveProperty("attendance.rate");
    await expect(teacherStats()).rejects.toThrow("اجازه انجام این عملیات را ندارید");
  });

  it("uses one generic error for an unknown user, wrong password, and inactive account", async () => {
    const failures = await Promise.all([
      login("nobody", "incorrect"),
      login("admin", "incorrect"),
      login("student5", "Student@1405"),
    ].map(p => p.then(() => "unexpected success", error => error.message)));

    expect(failures).toEqual(Array(3).fill("نام کاربری یا رمز عبور نادرست است."));
  });

  it("removes the local demo session on sign out", async () => {
    await login("admin", "Admin@1405");
    expect(await getMe()).not.toBeNull();
    logout();
    expect(await getMe()).toBeNull();
    await expect(adminStats()).rejects.toThrow("نشست شما منقضی شده است");
  });

  it("allows only admins to create assigned classes while teachers manage sessions and attendance", async () => {
    await login("teacher", "Teacher@1405");
    await expect(createClass("u-t1", { title: "کلاس غیرمجاز", active: true, memberIds: ["u-s1"] })).rejects.toThrow("اجازه انجام این عملیات را ندارید");
    logout();
    await login("admin", "Admin@1405");
    await expect(createClass("u-t1", { title: "کلاس نامعتبر", active: true, memberIds: ["u-s5"] })).rejects.toThrow("نامعتبر یا غیرفعال");
    const classroom = await createClass("u-t1", { title: "کلاس آزمایشی", active: true, memberIds: ["u-s1"] });
    logout();
    await login("teacher", "Teacher@1405");
    const session = await createSession(classroom.id, { date: "2026-10-17", files: [] });
    expect(session.title).toMatch(/^جلسه /);

    await saveAttendance(session.id, { "u-s1": "absent" });
    const result = await getSessionAttendance(session.id);
    expect(result.records["u-s1"]?.status).toBe("absent");
    expect(result.logs).toHaveLength(1);
  });

  it("keeps assessment scores private and exposes submitted results only to admins", async () => {
    await login("student", "Student@1405");
    const attempt = await startAttempt("a-1");
    expect(attempt.questions[0].options[0]).not.toHaveProperty("score");
    await submitAttempt(attempt.attemptId, { q1: "o1", q2: "o2" });
    await expect(listResults({})).rejects.toThrow("اجازه انجام این عملیات را ندارید");

    logout();
    await login("admin", "Admin@1405");
    await expect(listResults({})).resolves.toMatchObject([{ student: { username: "student" }, score: 5 }]);
  });
});
