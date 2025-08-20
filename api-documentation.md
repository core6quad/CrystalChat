# CrystalChat API Documentation

## Authentication

All endpoints that require authentication expect a `token` either in the `Authorization` header or in the request body.

---

## User Endpoints

### Register

**POST** `/api/register`

**Body:**
```json
{
  "username": "string (3-16 chars)",
  "password": "string (6-24 chars)",
  "ELUA": "true"
}
```
**Response:**  
201 Created, user info and token.

---

### Login (Get Token)

**POST** `/api/gettoken`

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response:**  
200 OK, `{ "token": "..." }`

---

### Who Am I

**POST** `/api/whoami`

**Body:**
```json
{
  "token": "string"
}
```
**Response:**  
200 OK, user info (no password).

---

### Get All Users (Admin Only)

**get** `/api/users`

requres IsAdmin === true
**Body:**
```json
{
  "token": "string"
}
```
**Response:**  
200 OK, list of users

### Get All chats (Admin Only)

**get** `/api/chats`

requres IsAdmin === true
**Body:**
```json
{
  "token": "string"
}
```
**Response:**  
200 OK, list of chats
