#[cfg(windows)]
pub(crate) struct ProcessTreeGuard(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for ProcessTreeGuard {}

#[cfg(windows)]
impl ProcessTreeGuard {
    pub(crate) fn attach(process_id: u32) -> Result<Self, String> {
        use std::mem::{size_of, zeroed};
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
        };

        // SAFETY: null security attributes and name create a private unnamed job object.
        let job = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if job.is_null() {
            return Err("Windows Job Object could not be created".into());
        }

        // SAFETY: the zeroed Win32 structure is initialized with the only limit flag used.
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: `limits` is a live buffer with the exact size required by this information class.
        let configured = unsafe {
            SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if configured == 0 {
            // SAFETY: `job` is a valid handle created above.
            unsafe { CloseHandle(job) };
            return Err("Windows Job Object could not be configured".into());
        }

        // SAFETY: the process id came from the PTY child created by this backend.
        let process = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, process_id) };
        if process.is_null() {
            // SAFETY: `job` is a valid handle created above.
            unsafe { CloseHandle(job) };
            return Err("PTY process could not be assigned to a Windows Job Object".into());
        }

        // SAFETY: both handles are valid and remain open for the duration of the call.
        let assigned = unsafe { AssignProcessToJobObject(job, process) };
        // SAFETY: `process` is a valid handle returned by OpenProcess.
        unsafe { CloseHandle(process) };
        if assigned == 0 {
            // SAFETY: `job` is a valid handle created above.
            unsafe { CloseHandle(job) };
            return Err("PTY process could not be assigned to a Windows Job Object".into());
        }
        Ok(Self(job))
    }

    pub(crate) fn terminate(&self) -> Result<(), String> {
        use windows_sys::Win32::System::JobObjects::TerminateJobObject;
        // SAFETY: the handle remains owned by this guard and termination is idempotent.
        let terminated = unsafe { TerminateJobObject(self.0, 1) };
        if terminated == 0 {
            return Err("Windows Job Object termination request failed".into());
        }
        Ok(())
    }

    pub(crate) fn active_process_count(&self) -> Result<u32, String> {
        use std::mem::{size_of, zeroed};
        use windows_sys::Win32::System::JobObjects::{
            JobObjectBasicAccountingInformation, QueryInformationJobObject,
            JOBOBJECT_BASIC_ACCOUNTING_INFORMATION,
        };

        // SAFETY: the zeroed structure is the documented output buffer for this information class.
        let mut accounting: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { zeroed() };
        // SAFETY: `self.0` is the live job handle owned by this guard. The output buffer and its
        // exact ABI size are valid for JobObjectBasicAccountingInformation.
        let queried = unsafe {
            QueryInformationJobObject(
                self.0,
                JobObjectBasicAccountingInformation,
                (&mut accounting as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                std::ptr::null_mut(),
            )
        };
        if queried == 0 {
            return Err("Windows Job Object process count could not be queried".into());
        }
        Ok(accounting.ActiveProcesses)
    }
}

#[cfg(windows)]
pub(crate) fn is_process_running(process_id: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // SAFETY: the test helper opens the requested process for a read-only status query.
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
    if process.is_null() {
        return false;
    }
    let mut exit_code = 0u32;
    // SAFETY: `process` is open and `exit_code` is a writable u32 out parameter.
    let succeeded = unsafe { GetExitCodeProcess(process, &mut exit_code) };
    // SAFETY: this helper owns the handle returned by OpenProcess.
    unsafe { CloseHandle(process) };
    succeeded != 0 && exit_code == 259 // STILL_ACTIVE
}

#[cfg(windows)]
impl Drop for ProcessTreeGuard {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        // The job is configured with KILL_ON_JOB_CLOSE, so this also cleans descendants.
        // SAFETY: this guard owns the handle and drops it exactly once.
        unsafe { CloseHandle(self.0) };
    }
}

#[cfg(not(windows))]
pub(crate) struct ProcessTreeGuard;

#[cfg(not(windows))]
impl ProcessTreeGuard {
    pub(crate) fn attach(_process_id: u32) -> Result<Self, String> {
        Ok(Self)
    }

    pub(crate) fn terminate(&self) -> Result<(), String> {
        Ok(())
    }

    pub(crate) fn active_process_count(&self) -> Result<u32, String> {
        Ok(0)
    }
}
