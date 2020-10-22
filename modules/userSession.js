const db = mrequire('./services/tvcdb')

const sessions = new Map()

function setUser(request, userData) {
  request.session.set('login', `${userData.uid}-${(new Date()).getTime()}`)
  sessions.set(request.session.get('login'), userData)
}
function deleteUser(request) {
  sessions.delete(request.session.get('login'))
  request.session.delete()
}

async function getUserData(uid) {
  const { result } = await db.query(`{
    result(func: uid(${uid})) {
      user_name
      phone_number
      role {
        role_name
        role.role_function {
          function_alias
          permission
        }
      }
    }
  }`)
  if(result.length) {
    const { user_name, phone_number = "", role: { role_name = "", role_function = [] } } = result[0]
    return {
      uid, user_name, phone_number, role: role_name, permission: role_function
    }
  }
  throw { statusCode: 401, message: 'unknown user' }
}

async function updateUserData(login) {
  const [uid] = login.split('-')
  const userData = await getUserData(uid)
  sessions.set(login, userData)
  return userData
}

async function getUser(request) {
  const login = request.session.get('login')
  return login && (sessions.get(login) || await updateUserData(login))
}
module.exports = {
  setUser, deleteUser, getUser, getUserData
}