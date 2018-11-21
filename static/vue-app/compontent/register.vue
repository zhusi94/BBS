<template>
  <div >
      
    <form class="form-horizontal">

      <div class="form-group">
        <label for="inputUsername" class="col-sm-2 col-xs-3 col-xs-offset-1 control-label">用户名</label>
        <div class="col-sm-3 col-xs-6">
          <input type="text"  v-model="username" class="form-control" id="inputUsername" placeholder="请输入用户名">
        </div>
      </div>
      
      <div class="form-group">
        <label for="inputPassword" class="col-sm-2 col-xs-3 col-xs-offset-1 control-label">密码</label>
        <div class="col-sm-3 col-xs-6">
          <input :type="passwordType" v-model="password" class="form-control" id="inputPassword" placeholder="请输入密码">
        </div>
        <div class="col-sm-1 col-xs-1">
          <span @click="changePasswordView">👀</span>
        </div>
      </div>
      
      <div class="form-group">
        <label for="inputAvatar" class="col-sm-2 col-xs-3 col-xs-offset-1 control-label">头像</label>
        <div class="col-sm-3 col-xs-7">
          <input type="file" required @change="getFile()" id="inputAvatar">
        </div>
      </div>
      

      <div class="form-group">
        <div class="col-sm-7">
          <button class="btn btn-default center-block" @click.prevent="submitForm">注册</button>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  data(){
      return {
        passwordType: "password",
        username:"",
        password:"",
        avatar:"",
        
      }
    },
    methods:{
      getFile(){
        this.avatar = event.target.files[0]
      },
      changePasswordView(){
        this.passwordType = "text"
      },
      async submitForm(){
        if(this.username == ""){
          alert("用户名不能为空")
        }else if(this.password == ""){
          alert("密码不能为空")
        }else if(this.avatar == ""){
          alert("头像不能为空")
        } else{
          let formData = new FormData()
          formData.append('username', this.username)
          formData.append('password', this.password);
          formData.append('avatar', this.avatar);
          let config = {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
          try{
            await this.$http.post("/api/register",formData,config)
            alert("恭喜您注册成功")
            this.$router.push("/login")
          }catch(e){
            alert("该用户名已被注册")
          }        
        }        

      },
    },
}
</script>

<style scoped>
  form{
    margin-top: 100px;
  }
</style>
