<?php
/**
 * ZCT工具类，
 *   1. md5签名
 *   2. AES解密
 *   2. 网络请求调用
 *
 */
class php_zct_object {
	private $url = "http://xxxx/service/rest";

	// 机构编号
	public $mercno = "";
	
	// 签名KEY
	private $key = "";
	
	// 加密Secret
	private $secret = "";
	

	// 初始化装载密钥信息，仅支持pem格式
	public function __construct($m_mercno, $m_key, $m_secret){
		$this->mercno = $m_mercno;
		$this->key = $m_key;
		$this->secret = $m_secret;
	}
	
	
	// 加密
	function aesEncrypt($plainText) {
		$plainText = urldecode($plainText);
		
		// 固定值
		$iv = '0102030405060708';
		$block = mcrypt_get_block_size(MCRYPT_RIJNDAEL_128, MCRYPT_MODE_CBC);
		$pad = $block - (strlen($plainText) % $block); //Compute how many characters need to pad
		$plainText .= str_repeat(chr($pad), $pad); // After pad, the str length must be equal to block or its integer multiples
		$encrypt_str =  mcrypt_encrypt(MCRYPT_RIJNDAEL_128, $this->secret, $plainText, MCRYPT_MODE_CBC, $iv);
		
		//获取信息串
		return base64_encode($encrypt_str);
	}
	
	// 解密
	function aesDecrypt($encrypted) {
		$iv = '0102030405060708';
		
		$result_info = base64_decode($encrypted);
		$result_info = mcrypt_decrypt(MCRYPT_RIJNDAEL_128, $this->secret, $result_info, MCRYPT_MODE_CBC, $iv);
		
		$plainText = rtrim(rtrim($result_info), "\x00..\x1F");
		
		return $plainText;
	}
	
	// 私钥进行签名
	function md5($encrypted) {
		return strtoupper(md5($encrypted.$this->key));
	}
	
	// 请求数据
	function doPost($contextPath, $data) {
		$ch = curl_init ();
		curl_setopt ( $ch, CURLOPT_URL, $this->url . $contextPath );
		curl_setopt ( $ch, CURLOPT_POST, 1 );
		curl_setopt ( $ch, CURLOPT_SSLVERSION, 1 );
		curl_setopt ( $ch, CURLOPT_HTTPHEADER, array (
				'Content-type:application/json;charset=UTF-8' 
		) );
		curl_setopt ( $ch, CURLOPT_POSTFIELDS, json_encode ( $data, JSON_UNESCAPED_UNICODE ) );
		curl_setopt ( $ch, CURLOPT_RETURNTRANSFER, true );
		$resp = curl_exec ( $ch );
		return $resp;
	}
	
}